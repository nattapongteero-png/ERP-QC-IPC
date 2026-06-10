/**
 * Triple Independence enforcement test for Goods Receipt QA service.
 * Verifies the core compliance rule: receiver ≠ QA approver, even for admin.
 *
 * Feature: 020-goods-receipt
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const memDb = {
  lines: [] as Record<string, unknown>[],
  signatures: [] as Record<string, unknown>[],
  users: [] as Record<string, unknown>[],
  qcSamples: [] as Record<string, unknown>[],
  inventoryLots: [] as Record<string, unknown>[],
  grns: [] as Record<string, unknown>[],
  deviations: [] as Record<string, unknown>[],
  items: [] as Record<string, unknown>[],
};

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  getTableRef: (n: string) => ({ __table: n }),
  getInsertId: (r: unknown) => Number((r as { lastInsertRowid: number }).lastInsertRowid),
  executeDbOperation: async (op: (db: unknown) => unknown) => op(makeMockDb()),
}));

vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => '2026-06-02T00:00:00.000Z',
  toDbDate: (v: string | Date) => (typeof v === 'string' ? v : v.toISOString()),
  getTodayStr: () => '2026-06-02',
}));

vi.mock('@/lib/services/goods-receipt.service', () => ({
  recomputeHeaderStatus: vi.fn(async () => undefined),
}));

vi.mock('@/lib/services/goods-receipt-tolerance.service', () => ({
  listTolerances: vi.fn(),
  upsertTolerance: vi.fn(),
}));

function makeMockDb() {
  const select = (cols?: unknown) => {
    const ctx: { table: string; where: unknown; limit?: number } = {
      table: '',
      where: undefined,
    };
    const builder = {
      from(tbl: { __table: string }) {
        ctx.table = tbl.__table;
        return builder;
      },
      where(_w: unknown) {
        ctx.where = _w;
        return builder;
      },
      limit(n: number) {
        ctx.limit = n;
        return builder;
      },
      then(resolve: (rows: unknown[]) => unknown) {
        const rows = filterByTable(ctx.table);
        return resolve(ctx.limit ? rows.slice(0, ctx.limit) : rows);
      },
    };
    return builder;
  };
  function filterByTable(name: string): Record<string, unknown>[] {
    if (name === 'goodsReceiptLines') return memDb.lines;
    if (name === 'electronicSignatures') return memDb.signatures;
    if (name === 'users') return memDb.users;
    if (name === 'qcSamples') return memDb.qcSamples;
    if (name === 'inventoryLots') return memDb.inventoryLots;
    if (name === 'goodsReceipts') return memDb.grns;
    if (name === 'deviations') return memDb.deviations;
    if (name === 'items') return memDb.items;
    return [];
  }
  return {
    select,
    insert(_tbl: { __table: string }) {
      return {
        values(v: Record<string, unknown>) {
          const tbl = _tbl.__table;
          const row = { ...v, id: filterByTable(tbl).length + 1 };
          filterByTable(tbl).push(row);
          return { lastInsertRowid: row.id };
        },
      };
    },
    update(_tbl: { __table: string }) {
      return {
        set(patch: Record<string, unknown>) {
          return {
            where(_w: unknown) {
              return Object.assign(filterByTable(_tbl.__table)[0] ?? {}, patch);
            },
          };
        },
      };
    },
  };
}

import { qaReleaseLine } from '@/lib/services/goods-receipt-qa.service';
import { GOODS_RECEIPT_ERROR_CODES, GoodsReceiptError } from '@/types/goods-receipt';

describe('Goods Receipt QA — Triple Independence', () => {
  beforeEach(() => {
    memDb.lines = [];
    memDb.signatures = [];
    memDb.users = [];
    memDb.qcSamples = [];
    memDb.inventoryLots = [];
    memDb.grns = [];
    memDb.deviations = [];
    memDb.items = [];
  });

  it('blocks the receiver-user from acting as QA approver (Triple Independence)', async () => {
    // Setup: line signed by user 7, QC sample approved
    const receiverUserId = 7;
    memDb.signatures.push({
      id: 1,
      userId: receiverUserId,
      entityType: 'goods_receipt_line',
      entityId: 100,
    });
    memDb.lines.push({
      id: 100,
      grnId: 1,
      status: 'qc_approved',
      receiverSignatureId: 1,
      inventoryLotId: 50,
      qcSampleId: 30,
    });
    memDb.qcSamples.push({ id: 30, status: 'approved' });
    memDb.users.push({ id: receiverUserId, username: 'wh1', fullName: 'Warehouse 1' });

    // Same user tries to release — must throw
    await expect(
      qaReleaseLine(100, { password: 'pw' }, receiverUserId),
    ).rejects.toBeInstanceOf(GoodsReceiptError);
  });

  it('blocks even if the same-user has admin role (no bypass)', async () => {
    const adminUserId = 1;
    memDb.signatures.push({
      id: 1,
      userId: adminUserId,
      entityType: 'goods_receipt_line',
      entityId: 100,
    });
    memDb.lines.push({
      id: 100,
      grnId: 1,
      status: 'qc_approved',
      receiverSignatureId: 1,
      inventoryLotId: 50,
      qcSampleId: 30,
    });
    memDb.qcSamples.push({ id: 30, status: 'approved' });
    memDb.users.push({ id: adminUserId, username: 'admin', fullName: 'Admin', title: 'Admin' });

    let caught: GoodsReceiptError | null = null;
    try {
      await qaReleaseLine(100, { password: 'pw' }, adminUserId);
    } catch (e) {
      caught = e as GoodsReceiptError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.code).toBe(GOODS_RECEIPT_ERROR_CODES.TRIPLE_INDEPENDENCE_VIOLATION);
  });

  it('allows release (legacy lot) when QA user differs from receiver', async () => {
    // Legacy line: a lot already exists (old flow created it at sign). Release
    // should flip that lot to 'released' without creating a second one.
    const receiverUserId = 7;
    const qaUserId = 8;
    memDb.signatures.push({
      id: 1,
      userId: receiverUserId,
      entityType: 'goods_receipt_line',
      entityId: 100,
    });
    memDb.lines.push({
      id: 100,
      grnId: 1,
      status: 'qc_approved',
      receiverSignatureId: 1,
      inventoryLotId: 50,
      sampleQuantity: 10,
      qcSampleId: 30,
    });
    memDb.qcSamples.push({ id: 30, status: 'approved' });
    memDb.users.push({ id: qaUserId, username: 'qa1', fullName: 'QA Officer', title: 'QA' });
    memDb.inventoryLots.push({ id: 50, status: 'quarantine' });

    const before = memDb.inventoryLots.length;
    const result = await qaReleaseLine(100, { password: 'pw' }, qaUserId, { actualQuantity: 100 });
    expect(result.lotStatus).toBe('released');
    // No new lot — the pre-existing one is released in place.
    expect(memDb.inventoryLots.length).toBe(before);
  });

  it('QC-first: creates the remainder lot (total − sample) in RM/FG on release', async () => {
    const receiverUserId = 7;
    const qaUserId = 8;
    memDb.signatures.push({
      id: 1,
      userId: receiverUserId,
      entityType: 'goods_receipt_line',
      entityId: 100,
    });
    // QC-first line: no remainder lot yet, only the QC sample was drawn.
    memDb.lines.push({
      id: 100,
      grnId: 1,
      lineNumber: 1,
      itemId: 5,
      unit: 'kg',
      status: 'qc_approved',
      receiverSignatureId: 1,
      inventoryLotId: null,
      qcLotId: 99,
      sampleQuantity: 30,
      qcSampleId: 30,
    });
    memDb.qcSamples.push({ id: 30, status: 'registered' });
    memDb.users.push({ id: qaUserId, username: 'qa1', fullName: 'QA Officer', title: 'QA' });
    memDb.grns.push({ id: 1, grnNumber: 'GRN-1', warehouseId: 1, sourceType: 'po' });
    memDb.items.push({ id: 5, code: 'RM-005', nameTh: 'สมุนไพร' });

    const before = memDb.inventoryLots.length;
    const result = await qaReleaseLine(100, { password: 'pw' }, qaUserId, { actualQuantity: 100 });
    expect(result.lotStatus).toBe('released');
    // A new lot was created for the remainder (100 − 30 = 70), released.
    expect(memDb.inventoryLots.length).toBe(before + 1);
    const newLot = memDb.inventoryLots[memDb.inventoryLots.length - 1];
    expect(Number(newLot.quantity)).toBe(70);
    expect(newLot.status).toBe('released');
    expect(Number(newLot.warehouseId)).toBe(1);
  });

  it('QC-first: rejects release when counted total is below the QC sample', async () => {
    const qaUserId = 8;
    memDb.signatures.push({
      id: 1,
      userId: 7,
      entityType: 'goods_receipt_line',
      entityId: 100,
    });
    memDb.lines.push({
      id: 100,
      grnId: 1,
      status: 'qc_approved',
      receiverSignatureId: 1,
      inventoryLotId: null,
      sampleQuantity: 30,
      qcSampleId: 30,
    });
    memDb.users.push({ id: qaUserId, username: 'qa1', fullName: 'QA Officer' });
    memDb.grns.push({ id: 1, grnNumber: 'GRN-1', warehouseId: 1, sourceType: 'po' });

    // total (20) < sample (30) → must throw, no lot created
    await expect(
      qaReleaseLine(100, { password: 'pw' }, qaUserId, { actualQuantity: 20 }),
    ).rejects.toBeInstanceOf(GoodsReceiptError);
    expect(memDb.inventoryLots.length).toBe(0);
  });
});
