/**
 * Variance analysis — real actuals (list items 9a, 9b, 9c, 9d).
 *
 * Proves calculateWorkOrderVariances now reads real consumption from
 * work_order_materials / work_order_operations and produces NON-ZERO variances
 * when actuals differ from standard (the old code hard-coded actual = standard,
 * so every variance was 0). Also checks the listVariances date filter.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  db: () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
  getClientIP: vi.fn(() => '127.0.0.1'),
}));

import {
  calculateWorkOrderVariances,
  listVariances,
} from '@/lib/services/variance-analysis.service';

const USER_ID = 1;
const ITEM_ID = 1;
const WO_ID = 100;

function seed() {
  sqlite.exec(`INSERT INTO users (id, email, password, name, role, is_active)
    VALUES (${USER_ID}, 't@t.com', 'h', 'T', 'admin', 1)`);
  sqlite.exec(`INSERT INTO items (id, code, name_th, type, primary_unit, is_active)
    VALUES (${ITEM_ID}, 'FG-1', 'Prod', 'finished_goods', 'box', 1)`);

  // Standard cost: material 100/unit, labor 50/unit, 2 std hours @ 25/hr.
  sqlite.exec(`INSERT INTO standard_costs
    (id, item_id, material_cost, labor_cost, overhead_cost, standard_hours, standard_labor_rate, total_cost, effective_date, is_current, created_by, created_at)
    VALUES (1, ${ITEM_ID}, 100, 50, 0, 2, 25, 150, '2026-01-01', 1, ${USER_ID}, CURRENT_TIMESTAMP)`);

  // BOM the work order is built from (bom_id is NOT NULL on work_orders).
  sqlite.exec(`INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, created_at, updated_at)
    VALUES (1, 'BOM-1', 'BOM 1', ${ITEM_ID}, '1', 'active', 10, 'box', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);

  // Completed WO producing 10 units (planned 10).
  sqlite.exec(`INSERT INTO work_orders
    (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, priority, requisition_status, completed_at, created_at, updated_at)
    VALUES (${WO_ID}, 'WO-1', 1, ${ITEM_ID}, 'BATCH-1', 10, 10, 'box', 'completed', 1, 'none', '2026-02-10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);

  // Actual material issued cost 1200 (standard 100*10 = 1000) → +200 unfavorable.
  sqlite.exec(`INSERT INTO work_order_materials
    (id, work_order_id, item_id, planned_quantity, actual_quantity, unit, unit_cost, total_cost, status, created_at)
    VALUES (1, ${WO_ID}, ${ITEM_ID}, 10, 12, 'kg', 100, 1200, 'issued', CURRENT_TIMESTAMP)`);

  // Actual labor cost 700 (standard 50*10 = 500), actual 24 hrs (standard 20).
  sqlite.exec(`INSERT INTO work_order_operations
    (id, work_order_id, operation_id, work_center_id, sequence, planned_hours, actual_hours, labor_rate, labor_cost, overhead_rate, overhead_cost, status, created_at, updated_at)
    VALUES (1, ${WO_ID}, 1, 1, 1, 20, 24, 25, 700, 0, 0, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
}

describe('Variance analysis — real actuals', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    const tables = [
      schema.sqliteUsers, schema.sqliteItems, schema.sqliteStandardCosts,
      schema.sqliteVarianceRecords, schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials, schema.sqliteWorkOrderOperations,
      schema.sqliteBOM, schema.sqliteBOMLines,
      schema.sqliteJournalEntries, schema.sqliteJournalLines,
      schema.sqliteFiscalPeriods,
    ];
    for (const t of tables) {
      try { sqlite.exec(generateCreateTableSql(t)); } catch { /* skip */ }
    }
  });

  afterAll(() => sqlite.close());

  beforeEach(() => {
    for (const t of ['variance_records', 'work_order_operations', 'work_order_materials', 'work_orders', 'bom', 'standard_costs', 'items', 'users']) {
      try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* ignore */ }
    }
    seed();
  });

  it('produces a non-zero MATERIAL variance from real consumption (9a)', async () => {
    const result = await calculateWorkOrderVariances(WO_ID, USER_ID);
    const mpv = result.variances.find((v) => v.varianceType === 'mpv');
    expect(mpv).toBeDefined();
    // actual 1200 - standard 1000 = +200
    expect(mpv!.varianceAmount).toBe(200);
    expect(mpv!.isFavorable).toBe(false);
  });

  it('produces a non-zero LABOR variance from real operations (9b)', async () => {
    const result = await calculateWorkOrderVariances(WO_ID, USER_ID);
    const lrv = result.variances.find((v) => v.varianceType === 'lrv');
    expect(lrv).toBeDefined();
    // actual labor 700 - standard 500 = +200
    expect(lrv!.varianceAmount).toBe(200);

    const lev = result.variances.find((v) => v.varianceType === 'lev');
    // (24 - 20) hrs * 25/hr = +100
    expect(lev!.varianceAmount).toBe(100);
  });

  it('at least one variance is non-zero overall (regression for the all-zero stub, 9d)', async () => {
    const result = await calculateWorkOrderVariances(WO_ID, USER_ID);
    const anyNonZero = result.variances.some((v) => Number(v.varianceAmount) !== 0);
    expect(anyNonZero).toBe(true);
  });

  it('applies the dateFrom/dateTo filter in listVariances (9c)', async () => {
    await calculateWorkOrderVariances(WO_ID, USER_ID);

    // Variance date is "today" (getTodayStr). A window that ends before any
    // plausible today returns nothing; an open-ended future-from also returns
    // nothing — proving the filter is actually applied, not ignored.
    const excluded = await listVariances({ workOrderId: WO_ID, dateTo: '2020-01-01' });
    expect(excluded.total).toBe(0);

    const included = await listVariances({ workOrderId: WO_ID, dateFrom: '2020-01-01' });
    expect(included.total).toBeGreaterThan(0);
  });
});
