/**
 * Material Return Service — Step 1/2/3 Integration Tests
 *
 * Covers the new behavior introduced by the IPC redesign:
 *   - Step 2: physical issuance (proven indirectly via the approve path that
 *     leans on the same `issuedQty` semantics)
 *   - Step 3: weight-based return flow → calculateReturn → RTN lot in PU
 *     - submitMaterialReturn  (returnUnit = secondaryUnit for tracked items)
 *     - updateMaterialReturn  (status='submitted' guard, line replacement)
 *     - approveMaterialReturn (SU→PU conversion + new lot in primary unit)
 *     - cancelMaterialReturnApproval (revert lot+txns, refuse if lot reused)
 *
 * Real SQLite, no mocks beyond the db module + audit side-effects.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', async () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  submitMaterialReturn,
  updateMaterialReturn,
  approveMaterialReturn,
  cancelMaterialReturnApproval,
  getMaterialReturnDetail,
} from '@/lib/services/material-return.service';

interface SeedResult {
  trackedItemId: number;
  nonTrackedItemId: number;
  warehouseId: number;
  trackedLotId: number;
  nonTrackedLotId: number;
  workOrderId: number;
  userId: number;
}

function runSql(sql: string): void {
  sqlite.prepare(sql).run();
}

async function seedFixtures(): Promise<SeedResult> {
  const now = new Date().toISOString();

  const wh = sqlite.prepare(
    `INSERT INTO warehouses (code, name, type, is_active, created_at, updated_at)
     VALUES ('WH-A', 'Main', 'raw_material', 1, ?, ?)`,
  ).run(now, now);
  const warehouseId = Number(wh.lastInsertRowid);

  const trackedRes = sqlite.prepare(
    `INSERT INTO items (code, name_th, type, primary_unit, secondary_unit,
       conversion_rate, weight_unit, secondary_to_weight_rate, weight_tracking_enabled,
       is_lot_controlled, is_fefo, is_active, on_hand, on_hand_cost, quarantine_qty,
       confidentiality_level, default_confidential, vmi_sync_enabled,
       sga_allocation_rate, created_at, updated_at)
     VALUES ('CAP-001', 'แคปซูลทดสอบ', 'raw_material', 'box', 'cap', 1000,
       'g', 0.1, 1, 1, 1, 1, 5, 0, 0, 'public', 0, 0, 0, ?, ?)`,
  ).run(now, now);
  const trackedItemId = Number(trackedRes.lastInsertRowid);

  const nonTrackedRes = sqlite.prepare(
    `INSERT INTO items (code, name_th, type, primary_unit, secondary_unit,
       conversion_rate, weight_tracking_enabled, is_lot_controlled, is_fefo,
       is_active, on_hand, on_hand_cost, quarantine_qty, confidentiality_level,
       default_confidential, vmi_sync_enabled, sga_allocation_rate, created_at, updated_at)
     VALUES ('PWD-001', 'ผงทดสอบ', 'raw_material', 'kg', NULL, NULL, 0, 1, 1, 1,
       100, 0, 0, 'public', 0, 0, 0, ?, ?)`,
  ).run(now, now);
  const nonTrackedItemId = Number(nonTrackedRes.lastInsertRowid);

  const trackedLotRes = sqlite.prepare(
    `INSERT INTO inventory_lots (item_id, lot_number, warehouse_id, quantity,
       reserved_quantity, unit, status, created_at, updated_at)
     VALUES (?, 'LOT-CAP-001', ?, 5, 0, 'box', 'released', ?, ?)`,
  ).run(trackedItemId, warehouseId, now, now);
  const trackedLotId = Number(trackedLotRes.lastInsertRowid);

  const nonTrackedLotRes = sqlite.prepare(
    `INSERT INTO inventory_lots (item_id, lot_number, warehouse_id, quantity,
       reserved_quantity, unit, status, created_at, updated_at)
     VALUES (?, 'LOT-PWD-001', ?, 100, 0, 'kg', 'released', ?, ?)`,
  ).run(nonTrackedItemId, warehouseId, now, now);
  const nonTrackedLotId = Number(nonTrackedLotRes.lastInsertRowid);

  const userRes = sqlite.prepare(
    `INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
     VALUES ('test@erp.local', 'x', 'Tester', 'operator', 1, ?, ?)`,
  ).run(now, now);
  const userId = Number(userRes.lastInsertRowid);

  const bomRes = sqlite.prepare(
    `INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, created_at, updated_at)
     VALUES ('BOM-TEST', 'Test BOM', ?, '1.0', 'approved', 100, 'box', ?, ?)`,
  ).run(trackedItemId, now, now);
  const bomId = Number(bomRes.lastInsertRowid);

  const woRes = sqlite.prepare(
    `INSERT INTO work_orders (wo_number, batch_number, product_id, bom_id,
       planned_quantity, unit, status, requisition_status, created_at, updated_at)
     VALUES ('WO-TEST-1', 'BATCH-1', ?, ?, 100, 'box', 'in_progress', 'approved', ?, ?)`,
  ).run(trackedItemId, bomId, now, now);
  const workOrderId = Number(woRes.lastInsertRowid);

  return {
    trackedItemId,
    nonTrackedItemId,
    warehouseId,
    trackedLotId,
    nonTrackedLotId,
    workOrderId,
    userId,
  };
}

beforeAll(() => {
  sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  testDb = drizzle(sqlite, { schema });

  const tables = [
    schema.sqliteUsers,
    schema.sqliteWarehouses,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqliteInventoryTransactions,
    schema.sqliteBOM,
    schema.sqliteWorkOrders,
    schema.sqliteWorkOrderMaterials,
    schema.sqliteMaterialReturns,
    schema.sqliteMaterialReturnLines,
    schema.sqliteMaterialVarianceTolerances,
    schema.sqliteDeviations,
  ];
  for (const t of tables) {
    try {
      runSql(generateCreateTableSql(t));
    } catch (e) {
      console.warn('Table create note:', (e as Error).message);
    }
  }
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(() => {
  for (const tableName of [
    'material_return_lines',
    'material_returns',
    'material_variance_tolerances',
    'inventory_transactions',
    'work_order_materials',
    'work_orders',
    'bom',
    'inventory_lots',
    'items',
    'warehouses',
    'users',
    'deviations',
  ]) {
    try {
      runSql(`DELETE FROM ${tableName}`);
      runSql(`DELETE FROM sqlite_sequence WHERE name='${tableName}'`);
    } catch {
      // Table might not exist for some suites
    }
  }
});

import type { MaterialReturnLineInput } from '@/lib/validation/material-return';

function baseLine(
  overrides: Partial<MaterialReturnLineInput> &
    Pick<MaterialReturnLineInput, 'sourceLotId' | 'itemId'>,
): MaterialReturnLineInput {
  return {
    issuedQty: 2000,
    issuedUnit: 'cap',
    usedQty: 1750,
    usedUnit: 'cap',
    returnQty: 250,
    returnUnit: 'cap',
    varianceReason: 'process_loss',
    containerLabel: 'RTN-A',
    containerType: 'bag',
    ...overrides,
  };
}

describe('Step 3 — submitMaterialReturn (weight-tracked)', () => {
  it('accepts a return with returnUnit=secondaryUnit', async () => {
    const ctx = await seedFixtures();
    const result = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });

    expect(result.status).toBe('submitted');
    expect(result.lineIds).toHaveLength(1);
    expect(result.outsideToleranceCount).toBe(0);
    expect(result.returnNumber).toMatch(/^RET-/);
  });

  it('rejects a return whose unit is not on the item (e.g. weight unit)', async () => {
    const ctx = await seedFixtures();
    await expect(
      submitMaterialReturn({
        workOrderId: ctx.workOrderId,
        receivingWarehouseId: ctx.warehouseId,
        operatorId: ctx.userId,
        notes: null,
        lines: [
          baseLine({
            sourceLotId: ctx.trackedLotId,
            itemId: ctx.trackedItemId,
            usedUnit: 'g',
            returnQty: 25,
            returnUnit: 'g',
          }),
        ],
      }),
    ).rejects.toThrow(/Return unit/);
  });
});

describe('Step 3 — updateMaterialReturn', () => {
  it('replaces lines and keeps status="submitted"', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: 'first try',
      lines: [
        baseLine({
          sourceLotId: ctx.trackedLotId,
          itemId: ctx.trackedItemId,
          usedQty: 1700,
          returnQty: 300,
        }),
      ],
    });

    const updated = await updateMaterialReturn(created.returnId, {
      notes: 'corrected after re-weighing',
      lines: [
        baseLine({
          sourceLotId: ctx.trackedLotId,
          itemId: ctx.trackedItemId,
          varianceReason: 'measurement_error',
          containerLabel: 'RTN-A-edited',
        }),
      ],
    });

    expect(updated.status).toBe('submitted');
    expect(updated.returnId).toBe(created.returnId);

    const lines = sqlite
      .prepare('SELECT * FROM material_return_lines WHERE return_id=?')
      .all(created.returnId) as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(1);
    expect(Number(lines[0].used_qty)).toBe(1750);
    expect(Number(lines[0].return_qty)).toBe(250);
    expect(lines[0].variance_reason).toBe('measurement_error');
  });

  it('refuses to update once approved', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });

    await approveMaterialReturn(created.returnId, ctx.userId);

    await expect(
      updateMaterialReturn(created.returnId, {
        notes: 'too late',
        lines: [
          baseLine({
            sourceLotId: ctx.trackedLotId,
            itemId: ctx.trackedItemId,
            usedQty: 1800,
            returnQty: 200,
          }),
        ],
      }),
    ).rejects.toThrow(/only 'submitted' is editable/);
  });
});

describe('Step 3 — approveMaterialReturn (PU conversion)', () => {
  it('converts SU return → PU when item is weight-tracked (250 cap → 0.25 box)', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });

    const result = await approveMaterialReturn(created.returnId, ctx.userId);

    expect(result.newLots).toHaveLength(1);
    const newLot = result.newLots[0];
    expect(newLot.quantity).toBeCloseTo(0.25, 6);

    const lotRow = sqlite
      .prepare('SELECT unit, quantity, parent_lot_id FROM inventory_lots WHERE id=?')
      .get(newLot.id) as Record<string, unknown>;
    expect(lotRow.unit).toBe('box');
    expect(Number(lotRow.quantity)).toBeCloseTo(0.25, 6);
    expect(Number(lotRow.parent_lot_id)).toBe(ctx.trackedLotId);

    const txns = sqlite
      .prepare(
        "SELECT quantity, unit FROM inventory_transactions WHERE lot_id=? AND transaction_type='return'",
      )
      .all(newLot.id) as Array<Record<string, unknown>>;
    expect(txns).toHaveLength(1);
    expect(Number(txns[0].quantity)).toBeCloseTo(0.25, 6);
    expect(txns[0].unit).toBe('box');
  });

  it('keeps return unit unchanged for non-tracked items', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [
        {
          sourceLotId: ctx.nonTrackedLotId,
          itemId: ctx.nonTrackedItemId,
          issuedQty: 10,
          issuedUnit: 'kg',
          usedQty: 7.5,
          usedUnit: 'kg',
          returnQty: 2.5,
          returnUnit: 'kg',
          varianceReason: 'process_loss',
          containerLabel: 'RTN-B',
          containerType: 'drum',
        },
      ],
    });

    const result = await approveMaterialReturn(created.returnId, ctx.userId);
    const newLot = result.newLots[0];
    const lotRow = sqlite
      .prepare('SELECT unit, quantity FROM inventory_lots WHERE id=?')
      .get(newLot.id) as Record<string, unknown>;
    expect(lotRow.unit).toBe('kg');
    expect(Number(lotRow.quantity)).toBe(2.5);
  });
});

describe('Step 3 — cancelMaterialReturnApproval', () => {
  it('reverts a received return back to submitted', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });
    const approveResult = await approveMaterialReturn(created.returnId, ctx.userId);
    const newLotId = approveResult.newLots[0].id;

    const cancelResult = await cancelMaterialReturnApproval(created.returnId, ctx.userId);

    expect(cancelResult.status).toBe('submitted');
    expect(cancelResult.removedLotIds).toContain(newLotId);

    const remainingLots = sqlite
      .prepare('SELECT * FROM inventory_lots WHERE id=?')
      .all(newLotId);
    expect(remainingLots).toHaveLength(0);

    const remainingTxns = sqlite
      .prepare(
        "SELECT * FROM inventory_transactions WHERE reference_type='material_return' AND reference_id=?",
      )
      .all(created.returnId);
    expect(remainingTxns).toHaveLength(0);

    const header = sqlite
      .prepare('SELECT status, approved_by, approved_at FROM material_returns WHERE id=?')
      .get(created.returnId) as Record<string, unknown>;
    expect(header.status).toBe('submitted');
    expect(header.approved_by).toBeNull();
    expect(header.approved_at).toBeNull();
  });

  it('refuses to cancel when the RTN lot has been used downstream', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });
    const approveResult = await approveMaterialReturn(created.returnId, ctx.userId);
    const newLotId = approveResult.newLots[0].id;

    const now = new Date().toISOString();
    sqlite.prepare(
      `INSERT INTO inventory_transactions (lot_id, transaction_type, quantity, unit,
         reference_type, reference_id, reference_number, performed_by, created_at)
       VALUES (?, 'issue', -0.1, 'box', 'WO', 999, 'WO-DOWNSTREAM', ?, ?)`,
    ).run(newLotId, ctx.userId, now);

    await expect(
      cancelMaterialReturnApproval(created.returnId, ctx.userId),
    ).rejects.toThrow(/มีการเคลื่อนไหวต่อ/);
  });

  it('refuses to cancel when status is not received', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });

    await expect(
      cancelMaterialReturnApproval(created.returnId, ctx.userId),
    ).rejects.toThrow(/not in 'received' status/);
  });
});

describe('Step 3 — getMaterialReturnDetail', () => {
  it('round-trips a submitted return with all lines visible', async () => {
    const ctx = await seedFixtures();
    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: 'detail check',
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });

    const detail = await getMaterialReturnDetail(created.returnId);
    expect(detail).toBeTruthy();
    expect(detail!.status).toBe('submitted');
    expect(detail!.lines).toHaveLength(1);
    expect(Number(detail!.lines[0].returnQty)).toBe(250);
  });
});

describe('Step 2 ↔ Step 3 reconciliation', () => {
  it('after submit+approve, the source lot quantity is unchanged (return creates a sibling lot)', async () => {
    const ctx = await seedFixtures();

    const before = sqlite
      .prepare('SELECT quantity FROM inventory_lots WHERE id=?')
      .get(ctx.trackedLotId) as { quantity: number };

    const created = await submitMaterialReturn({
      workOrderId: ctx.workOrderId,
      receivingWarehouseId: ctx.warehouseId,
      operatorId: ctx.userId,
      notes: null,
      lines: [baseLine({ sourceLotId: ctx.trackedLotId, itemId: ctx.trackedItemId })],
    });
    await approveMaterialReturn(created.returnId, ctx.userId);

    const after = sqlite
      .prepare('SELECT quantity FROM inventory_lots WHERE id=?')
      .get(ctx.trackedLotId) as { quantity: number };
    expect(Number(after.quantity)).toBe(Number(before.quantity));

    const children = sqlite
      .prepare('SELECT id, quantity, unit FROM inventory_lots WHERE parent_lot_id=?')
      .all(ctx.trackedLotId) as Array<{ id: number; quantity: number; unit: string }>;
    expect(children).toHaveLength(1);
    expect(children[0].unit).toBe('box');
    expect(Number(children[0].quantity)).toBeCloseTo(0.25, 6);
  });
});
