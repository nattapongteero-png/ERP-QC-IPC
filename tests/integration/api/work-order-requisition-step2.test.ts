/**
 * Material Requisition — Step 2 Integration Tests
 *
 * Verifies the warehouse-side `approve` action of POST
 * /api/production/work-orders/[id]/requisition end-to-end:
 *
 *  - 3-level item: planned 1,700 cap → calculateIssuance → 2 box released
 *    (Math.ceil — whole primary units only)
 *  - FEFO multi-lot allocation when one lot can't satisfy the request
 *  - Stock deducted at approval (so weighing step does NOT deduct again)
 *  - work_order_materials marked status='issued' with issuedQty in SU
 *  - Concurrent-approval guard (second request gets 409)
 *  - Insufficient stock blocks approval cleanly
 *
 * Real SQLite, real inventory.service paths, mocks limited to:
 *  - @/lib/db (in-memory SQLite)
 *  - @/lib/api-utils withAuth (skip auth, inject session)
 *  - @/lib/realtime publish (no-op)
 *  - @/lib/audit createAuditLog (no-op)
 *  - @/lib/services/accounting recordMaterialCost (no-op — accounting tested elsewhere)
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

vi.mock('@/lib/realtime', () => ({
  realtimeBus: { publish: vi.fn() },
}));

vi.mock('@/lib/services/accounting.service', () => ({
  recordMaterialCost: vi.fn(() => Promise.resolve(0)),
}));

// Auth: bypass session check, inject a fake operator session.
vi.mock('@/lib/api-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-utils')>('@/lib/api-utils');
  return {
    ...actual,
    withAuth: (
      _req: Request,
      handler: (s: { userId: number; role: string }) => Promise<Response>,
    ) => handler({ userId: 1, role: 'admin' }),
  };
});

import { POST as requisitionPost } from '@/app/api/production/work-orders/[id]/requisition/route';

interface SeedResult {
  trackedItemId: number;
  warehouseId: number;
  oldLotId: number;
  newLotId: number;
  workOrderId: number;
  materialRowId: number;
  woNumber: string;
  batchNumber: string;
  userId: number;
}

function runSql(sql: string): void {
  sqlite.prepare(sql).run();
}

function callApprove(workOrderId: number) {
  const req = new Request(`http://localhost/api/production/work-orders/${workOrderId}/requisition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'approve' }),
  });
  return requisitionPost(req as Parameters<typeof requisitionPost>[0], {
    params: Promise.resolve({ id: String(workOrderId) }),
  });
}

/**
 * Seeds: 1 tracked item (1 box = 1000 cap, 1 cap = 0.1 g), two released lots
 * (FEFO order: oldLot 1.5 box first → newLot 5 box). WO needs 1700 cap, planned
 * in SU. requisitionStatus='requested' so approve is the only action.
 */
async function seedFixtures(): Promise<SeedResult> {
  const now = new Date().toISOString();

  const userRes = sqlite.prepare(
    `INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
     VALUES ('test@erp.local', 'x', 'Tester', 'admin', 1, ?, ?)`,
  ).run(now, now);
  const userId = Number(userRes.lastInsertRowid);

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
       'g', 0.1, 1, 1, 1, 1, 6.5, 0, 0, 'public', 0, 0, 0, ?, ?)`,
  ).run(now, now);
  const trackedItemId = Number(trackedRes.lastInsertRowid);

  // Older lot first (FEFO sorts by expiry then by created_at). Lot has 1.5 box
  // — not enough alone for the 2-box request, so allocator must spill into the
  // newer lot.
  const oldLotRes = sqlite.prepare(
    `INSERT INTO inventory_lots (item_id, lot_number, warehouse_id, quantity,
       reserved_quantity, unit, status, expiry_date, created_at, updated_at)
     VALUES (?, 'LOT-OLD', ?, 1.5, 0, 'box', 'released', '2026-06-01', ?, ?)`,
  ).run(trackedItemId, warehouseId, now, now);
  const oldLotId = Number(oldLotRes.lastInsertRowid);

  const newLotRes = sqlite.prepare(
    `INSERT INTO inventory_lots (item_id, lot_number, warehouse_id, quantity,
       reserved_quantity, unit, status, expiry_date, created_at, updated_at)
     VALUES (?, 'LOT-NEW', ?, 5, 0, 'box', 'released', '2027-12-31', ?, ?)`,
  ).run(trackedItemId, warehouseId, now, now);
  const newLotId = Number(newLotRes.lastInsertRowid);

  const bomRes = sqlite.prepare(
    `INSERT INTO bom (code, name, product_id, version, status, batch_size, batch_unit, created_at, updated_at)
     VALUES ('BOM-S2', 'Step2 BOM', ?, '1.0', 'approved', 100, 'box', ?, ?)`,
  ).run(trackedItemId, now, now);
  const bomId = Number(bomRes.lastInsertRowid);

  const woRes = sqlite.prepare(
    `INSERT INTO work_orders (wo_number, batch_number, product_id, bom_id,
       planned_quantity, unit, status, requisition_status, created_at, updated_at)
     VALUES ('WO-S2-001', 'BATCH-S2', ?, ?, 100, 'box', 'in_progress', 'requested', ?, ?)`,
  ).run(trackedItemId, bomId, now, now);
  const workOrderId = Number(woRes.lastInsertRowid);

  // Planned 1,700 cap (in SU) — warehouse must release 2 box (Math.ceil(1700/1000)).
  const matRes = sqlite.prepare(
    `INSERT INTO work_order_materials (work_order_id, item_id, planned_quantity,
       unit, status, created_at)
     VALUES (?, ?, 1700, 'cap', 'pending', ?)`,
  ).run(workOrderId, trackedItemId, now);
  const materialRowId = Number(matRes.lastInsertRowid);

  return {
    trackedItemId,
    warehouseId,
    oldLotId,
    newLotId,
    workOrderId,
    materialRowId,
    woNumber: 'WO-S2-001',
    batchNumber: 'BATCH-S2',
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
    'inventory_transactions',
    'work_order_materials',
    'work_orders',
    'bom',
    'inventory_lots',
    'items',
    'warehouses',
    'users',
  ]) {
    try {
      runSql(`DELETE FROM ${tableName}`);
      runSql(`DELETE FROM sqlite_sequence WHERE name='${tableName}'`);
    } catch {
      // table may not exist for some suites
    }
  }
});

describe('Step 2 — POST /requisition (approve action)', () => {
  it('releases exactly 2 boxes for a 1,700-cap request and FEFO-allocates oldest lot first', async () => {
    const ctx = await seedFixtures();

    const res = await callApprove(ctx.workOrderId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.requisitionStatus).toBe('approved');

    // Issuance summary: one material row, 2 box (= 2,000 cap)
    expect(body.data.issued).toHaveLength(1);
    expect(body.data.issued[0]).toMatchObject({
      itemCode: 'CAP-001',
      puToIssue: 2,
      pu: 'box',
      suIssued: 2000,
      su: 'cap',
    });

    // Lot quantities: old lot fully drained (1.5 → 0), new lot partial (5 → 4.5)
    const oldLot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id=?').get(ctx.oldLotId) as { quantity: number };
    const newLot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id=?').get(ctx.newLotId) as { quantity: number };
    expect(oldLot.quantity).toBeCloseTo(0, 6);
    expect(newLot.quantity).toBeCloseTo(4.5, 6);

    // Two issue transactions, summed -2 box
    const txns = sqlite.prepare(
      "SELECT lot_id, quantity, unit, reference_type, reference_id FROM inventory_transactions WHERE transaction_type='issue' ORDER BY id"
    ).all() as Array<{ lot_id: number; quantity: number; unit: string; reference_type: string; reference_id: number }>;
    expect(txns).toHaveLength(2);
    expect(txns[0].lot_id).toBe(ctx.oldLotId);
    expect(txns[0].quantity).toBeCloseTo(-1.5, 6);
    expect(txns[1].lot_id).toBe(ctx.newLotId);
    expect(txns[1].quantity).toBeCloseTo(-0.5, 6);
    for (const t of txns) {
      expect(t.unit).toBe('box');
      expect(t.reference_type).toBe('WO');
      expect(t.reference_id).toBe(ctx.workOrderId);
    }
  });

  it("marks the WO material row status='issued' with issuedQty in SU", async () => {
    const ctx = await seedFixtures();
    await callApprove(ctx.workOrderId);

    const row = sqlite.prepare(
      'SELECT status, actual_quantity, issued_qty, lot_id FROM work_order_materials WHERE id=?'
    ).get(ctx.materialRowId) as {
      status: string;
      actual_quantity: number;
      issued_qty: number;
      lot_id: number | null;
    };

    // status='issued' is the gate verifyMaterialWeight uses to skip a second
    // deduction at weighing time. issuedQty (SU) is what calculateReturn uses
    // later to compute the leftover: returnedPU = (issuedSU − usedSU) / ratio1.
    expect(row.status).toBe('issued');
    expect(row.actual_quantity).toBeCloseTo(2, 6);
    expect(row.issued_qty).toBeCloseTo(2000, 6);
    expect(row.lot_id).toBe(ctx.oldLotId); // first lot from FEFO
  });

  it('blocks approval when on-hand stock is insufficient', async () => {
    const ctx = await seedFixtures();

    // Drain the new lot so total available = 1.5 box = 1,500 cap, but the WO
    // needs 1,700 cap. Stock check rejects before any deduction happens.
    sqlite.prepare('UPDATE inventory_lots SET quantity=0 WHERE id=?').run(ctx.newLotId);

    const res = await callApprove(ctx.workOrderId);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/วัตถุดิบไม่เพียงพอ/);

    // Old lot must NOT have been touched.
    const oldLot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id=?').get(ctx.oldLotId) as { quantity: number };
    expect(oldLot.quantity).toBeCloseTo(1.5, 6);

    const txns = sqlite.prepare("SELECT id FROM inventory_transactions WHERE transaction_type='issue'").all();
    expect(txns).toHaveLength(0);

    const wo = sqlite.prepare('SELECT requisition_status FROM work_orders WHERE id=?').get(ctx.workOrderId) as { requisition_status: string };
    expect(wo.requisition_status).toBe('requested');
  });

  it('atomic guard: a second concurrent approve is rejected (one winner only)', async () => {
    const ctx = await seedFixtures();

    const [first, second] = await Promise.all([
      callApprove(ctx.workOrderId),
      callApprove(ctx.workOrderId),
    ]);

    // The atomic UPDATE ... WHERE requisitionStatus='requested' guarantees
    // only one approve can flip the WO to 'approved'. The loser is rejected
    // either by the early status check (400) or — if both reads saw
    // 'requested' before the first write committed — by the atomic guard's
    // affectedRows=0 path (409). Both prove the WO-level guard works.
    //
    // Note: lot-level concurrency safety (preventing two interleaved
    // issueMaterial calls from both deducting the same lot) is a separate
    // concern handled outside this code path; not asserted here.
    const winners = [first.status, second.status].filter((s) => s === 200);
    const losers = [first.status, second.status].filter((s) => s !== 200);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect([400, 409]).toContain(losers[0]);

    // Final WO state must be 'approved' (single transition).
    const wo = sqlite.prepare('SELECT requisition_status FROM work_orders WHERE id=?').get(ctx.workOrderId) as { requisition_status: string };
    expect(wo.requisition_status).toBe('approved');
  });
});

describe('Step 2 — request action (operator submits)', () => {
  it("transitions requisitionStatus from 'none' → 'requested'", async () => {
    const ctx = await seedFixtures();
    // Reset to 'none' so we can test the request path
    sqlite.prepare("UPDATE work_orders SET requisition_status='none' WHERE id=?").run(ctx.workOrderId);

    const req = new Request(`http://localhost/api/production/work-orders/${ctx.workOrderId}/requisition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'request' }),
    });
    const res = await requisitionPost(req as Parameters<typeof requisitionPost>[0], {
      params: Promise.resolve({ id: String(ctx.workOrderId) }),
    });

    expect(res.status).toBe(200);
    const wo = sqlite.prepare('SELECT requisition_status FROM work_orders WHERE id=?').get(ctx.workOrderId) as { requisition_status: string };
    expect(wo.requisition_status).toBe('requested');
  });

  it("rejects 'request' when requisitionStatus is not 'none'", async () => {
    const ctx = await seedFixtures(); // already 'requested'
    const req = new Request(`http://localhost/api/production/work-orders/${ctx.workOrderId}/requisition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'request' }),
    });
    const res = await requisitionPost(req as Parameters<typeof requisitionPost>[0], {
      params: Promise.resolve({ id: String(ctx.workOrderId) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Requisition already submitted/);
  });
});
