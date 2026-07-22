/**
 * GRN release destination-warehouse routing (item 40 regression test).
 *
 * A finished-goods receipt must release its remainder lot into the FINISHED
 * GOODS warehouse — NOT the raw-material warehouse the auto-created PO GRN
 * header defaulted to. A raw-material receipt must release into RAW MATERIAL.
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
  warehouses: [] as Record<string, unknown>[],
};

vi.mock('@/lib/db/db-helper', () => ({
  isSqlite: () => true,
  // Return a proxy so `table.__table` yields the table name and any other
  // property access (e.g. `warehouses.type`) yields a tagged column ref the
  // fake `eq` below can read.
  getTableRef: (n: string) =>
    new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === '__table') return n;
          return { __table: n, __column: prop };
        },
      },
    ),
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

// The warehouse-resolver reads/creates warehouses through the same mock db, so
// it does NOT need mocking — it exercises the real resolution logic.

function filterByTable(name: string): Record<string, unknown>[] {
  switch (name) {
    case 'goodsReceiptLines':
      return memDb.lines;
    case 'electronicSignatures':
      return memDb.signatures;
    case 'users':
      return memDb.users;
    case 'qcSamples':
      return memDb.qcSamples;
    case 'inventoryLots':
      return memDb.inventoryLots;
    case 'goodsReceipts':
      return memDb.grns;
    case 'deviations':
      return memDb.deviations;
    case 'items':
      return memDb.items;
    case 'warehouses':
      return memDb.warehouses;
    default:
      return [];
  }
}

// A `where` predicate produced by our fake `eq`. We record the column tag and
// value so the mock can actually filter (needed to resolve a warehouse by type).
type Pred = { __col?: string; __val?: unknown } | undefined;

function makeMockDb() {
  const select = () => {
    const ctx: { table: string; where: Pred; limit?: number } = {
      table: '',
      where: undefined,
    };
    const builder = {
      from(tbl: { __table: string }) {
        ctx.table = tbl.__table;
        return builder;
      },
      where(w: Pred) {
        ctx.where = w;
        return builder;
      },
      limit(n: number) {
        ctx.limit = n;
        return builder;
      },
      then(resolve: (rows: unknown[]) => unknown) {
        let rows = filterByTable(ctx.table);
        if (ctx.where && ctx.where.__col) {
          rows = rows.filter((r) => (r as Record<string, unknown>)[ctx.where!.__col!] === ctx.where!.__val);
        }
        return resolve(ctx.limit ? rows.slice(0, ctx.limit) : rows);
      },
    };
    return builder;
  };
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
            where() {
              return Object.assign(filterByTable(_tbl.__table)[0] ?? {}, patch);
            },
          };
        },
      };
    },
  };
}

// Fake `eq` so warehouse-type filtering works in the mock. Drizzle's real `eq`
// returns an opaque SQL object; here we tag the column name + value.
vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: (col: { __column?: string } | unknown, val: unknown) => {
      // Our proxy column refs carry `.__column` (the property name accessed).
      const name =
        typeof col === 'object' && col && '__column' in col
          ? (col as { __column?: string }).__column
          : undefined;
      return { __col: name, __val: val };
    },
  };
});

import { qaReleaseLine } from '@/lib/services/goods-receipt-qa.service';

function seedCommon(itemType: string) {
  const receiverUserId = 7;
  const qaUserId = 8;
  memDb.signatures.push({ id: 1, userId: receiverUserId, entityType: 'goods_receipt_line', entityId: 100 });
  memDb.lines.push({
    id: 100,
    grnId: 1,
    lineNumber: 1,
    itemId: 5,
    unit: 'kg',
    status: 'qc_approved',
    receiverSignatureId: 1,
    inventoryLotId: null,
    sampleQuantity: 30,
    qcSampleId: 30,
  });
  memDb.users.push({ id: qaUserId, username: 'qa1', fullName: 'QA Officer', title: 'QA' });
  // GRN header defaults to the RAW MATERIAL warehouse (id 1) — the bug.
  memDb.grns.push({ id: 1, grnNumber: 'GRN-1', warehouseId: 1, sourceType: 'po', vendorId: null });
  memDb.items.push({ id: 5, code: 'X-005', nameTh: 'สินค้า', type: itemType });
  // Pre-seed both warehouses so the resolver finds (not creates) them.
  memDb.warehouses.push({ id: 1, code: 'WH-RM', name: 'RM', type: 'raw_material' });
  memDb.warehouses.push({ id: 2, code: 'WH-FG', name: 'FG', type: 'finished_goods' });
  return qaUserId;
}

describe('GRN release — destination warehouse by item type (item 40)', () => {
  beforeEach(() => {
    memDb.lines = [];
    memDb.signatures = [];
    memDb.users = [];
    memDb.qcSamples = [];
    memDb.inventoryLots = [];
    memDb.grns = [];
    memDb.deviations = [];
    memDb.items = [];
    memDb.warehouses = [];
  });

  it('routes a FINISHED_GOODS receipt into the finished-goods warehouse (not RM)', async () => {
    const qaUserId = seedCommon('finished_goods');
    const result = await qaReleaseLine(100, { password: 'pw' }, qaUserId, { actualQuantity: 100 });
    expect(result.lotStatus).toBe('released');
    const newLot = memDb.inventoryLots[memDb.inventoryLots.length - 1];
    expect(Number(newLot.quantity)).toBe(70);
    // The FG warehouse is id 2 — NOT the GRN header's raw-material warehouse (1).
    expect(Number(newLot.warehouseId)).toBe(2);
  });

  it('routes a RAW_MATERIAL receipt into the raw-material warehouse', async () => {
    const qaUserId = seedCommon('raw_material');
    const result = await qaReleaseLine(100, { password: 'pw' }, qaUserId, { actualQuantity: 100 });
    expect(result.lotStatus).toBe('released');
    const newLot = memDb.inventoryLots[memDb.inventoryLots.length - 1];
    expect(Number(newLot.warehouseId)).toBe(1);
  });

  it('honours an explicit warehouse override regardless of item type', async () => {
    const qaUserId = seedCommon('finished_goods');
    const result = await qaReleaseLine(100, { password: 'pw' }, qaUserId, {
      actualQuantity: 100,
      warehouseId: 99,
    });
    expect(result.lotStatus).toBe('released');
    const newLot = memDb.inventoryLots[memDb.inventoryLots.length - 1];
    expect(Number(newLot.warehouseId)).toBe(99);
  });
});
