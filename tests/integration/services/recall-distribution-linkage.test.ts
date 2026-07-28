/**
 * Recall — Distribution Linkage Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9 — Product Recall)
 *
 * Supplements recall-service-real.test.ts. Where that file proves the lifecycle
 * persists, THIS file proves the data LINKAGE that makes a recall traceable:
 *
 *   - distributedQuantity is auto-derived from DELIVERED sales orders only
 *   - the affected lot is linked back to the customer it was shipped to
 *   - returned qty (notifications) and reconciliation roll up into the recall
 *   - the effectiveness rate is computed exactly as reconciled / distributed
 *
 * Real in-memory SQLite, tables created from the Drizzle ORM schema.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// ============================================
// Constants
// ============================================
const USER = { COORDINATOR: 1, QA: 2 };
const PRODUCT = { A: 1 };
const LOT = { A: 1 };
const CUSTOMER = { HOSPITAL: 1 };

const now = new Date();
const year = now.getFullYear();
const DATES = {
  PAST: `${year - 1}-06-15`,
  FUTURE: `${year + 1}-06-15`,
};

// getDistributionData joins sales_orders.customer_name -> customers.name,
// so the seed keeps both identical.
const CUSTOMER_NAME = 'โรงพยาบาลทดสอบ';

// ============================================
// Schema-sync helper (inline)
// ============================================
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];
  for (const [, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;
    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number': def += 'INTEGER'; break;
      case 'boolean': def += 'INTEGER'; break;
      default: def += 'TEXT';
    }
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      const dv = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      if (dv !== null && typeof dv !== 'function') def += ` DEFAULT ${dv}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';
    columnDefs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

// ============================================
// Test DB + mocks
// ============================================
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
  createRecall,
  startRecall,
  calculateDistributedQuantity,
  getDistributionData,
  getRecallDetails,
  createNotification,
  updateNotification,
  recordReconciliation,
} from '@/lib/services/recall-service';

function syncSchema() {
  const tables = [
    schema.sqliteUsers,
    schema.sqliteWarehouses,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqliteCustomers,
    schema.sqliteSalesOrders,
    schema.sqliteSalesOrderLines,
    // The shipment record of truth — recall traceability reads the shipped lot
    // from here, not from sales_order_lines.lot_id (NULL in practice).
    schema.sqliteSalesDeliveries,
    schema.sqliteComplaints,
    schema.sqliteRecalls,
    schema.sqliteRecallNotifications,
    schema.sqliteRecallReconciliation,
  ];
  for (const t of tables) {
    try { sqlite.exec(generateCreateTableSql(t)); }
    catch (err) { console.log(`Table creation note: ${err}`); }
  }
}

function seed() {
  sqlite.exec(`
    INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
    VALUES
      (${USER.COORDINATOR}, 'Recall Coordinator', 'coord@test.com', 'h', 'qa_manager', 1),
      (${USER.QA}, 'QA Manager', 'qa@test.com', 'h', 'qa_manager', 1)
  `);
  sqlite.exec(`INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active) VALUES (1, 'WH-001', 'Main', 'finished_goods', 1)`);
  sqlite.exec(`
    INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active)
    VALUES (${PRODUCT.A}, 'FG-001', 'สมุนไพร A', 'Herbal A', 'finished_product', 'capsule', 'box', 1)
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO inventory_lots (id, lot_number, item_id, warehouse_id, quantity, unit, status, expiry_date, manufacturing_date)
    VALUES (${LOT.A}, 'LOT-A-0001', ${PRODUCT.A}, 1, 1000, 'box', 'released', '${DATES.FUTURE}', '${DATES.PAST}')
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO customers (id, code, name, phone, email, customer_type, is_active)
    VALUES (${CUSTOMER.HOSPITAL}, 'CUST-001', '${CUSTOMER_NAME}', '02-111-2222', 'hospital@test.com', 'hospital', 1)
  `);

  // SHIPPED order: 600 boxes of LOT A — should be counted.
  //
  // What makes a quantity "distributed" is the existence of a DELIVERY record,
  // not the order's status string. The service used to filter on
  // sales_orders.status = 'delivered', a value no real order ever carries
  // (live data is 'draft'/'shipped' only), and read the lot from
  // sales_order_lines.lot_id, which is NULL on every real row. Both are fixed;
  // this seed now models what production actually writes.
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_orders (id, so_number, customer_id, customer_name, status, order_date, shipped_date, currency, source)
    VALUES (1, 'SO-0001', ${CUSTOMER.HOSPITAL}, '${CUSTOMER_NAME}', 'shipped', '${DATES.PAST}', '${DATES.PAST}', 'THB', 'direct')
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_order_lines (id, so_id, item_id, lot_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price)
    VALUES (1, 1, ${PRODUCT.A}, ${LOT.A}, 600, 600, 600, 'box', 100, 60000)
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_deliveries (id, so_id, so_line_id, item_id, lot_id, lot_number, quantity, unit, delivery_date, delivery_number, status, created_by)
    VALUES (1, 1, 1, ${PRODUCT.A}, ${LOT.A}, 'LOT-A-0001', 600, 'box', '${DATES.PAST}', 'DL-0001', 'delivered', ${USER.COORDINATOR})
  `);

  // Order with NOTHING shipped for the same lot — must be IGNORED, because no
  // delivery record exists for it.
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_orders (id, so_number, customer_id, customer_name, status, order_date, currency, source)
    VALUES (2, 'SO-0002', ${CUSTOMER.HOSPITAL}, '${CUSTOMER_NAME}', 'confirmed', '${DATES.PAST}', 'THB', 'direct')
  `);
  sqlite.exec(`
    INSERT OR IGNORE INTO sales_order_lines (id, so_id, item_id, lot_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price)
    VALUES (2, 2, ${PRODUCT.A}, ${LOT.A}, 200, 0, 0, 'box', 100, 20000)
  `);
}

function clean() {
  for (const t of [
    'recall_reconciliation', 'recall_notifications', 'recalls',
    'sales_deliveries', 'sales_order_lines', 'sales_orders', 'customers',
    'inventory_lots', 'items', 'warehouses', 'users',
  ]) {
    sqlite.exec(`DELETE FROM ${t}`);
  }
}

async function recallForLotA() {
  return createRecall(
    {
      recallClass: 'class_ii',
      reason: 'ผลตรวจความชื้นเกินเกณฑ์ — ต้องเรียกคืนเพื่อตรวจซ้ำ',
      productId: PRODUCT.A,
      affectedLots: [LOT.A],
      coordinatorId: USER.COORDINATOR,
    },
    USER.COORDINATOR,
  );
}

describe('Recall — Distribution Linkage', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });
    syncSchema();
    seed();
  });
  afterAll(() => sqlite.close());
  beforeEach(() => { clean(); seed(); });

  describe('auto-derived distribution (delivered sales orders only)', () => {
    it('counts only delivered qty (600), ignoring the 200 with no delivery record', async () => {
      const qty = await calculateDistributedQuantity([LOT.A]);
      expect(qty).toBe(600);
    });

    it('startRecall stamps distributedQuantity = 600 and goes in_progress', async () => {
      const recall = await recallForLotA();
      const started = await startRecall(recall.id, USER.COORDINATOR);
      expect(started!.status).toBe('in_progress');
      expect(started!.distributedQuantity).toBe(600);
    });

    it('links the affected lot back to the customer it shipped to', async () => {
      const recall = await recallForLotA();
      await startRecall(recall.id, USER.COORDINATOR);

      const dist = await getDistributionData(recall.id);
      expect(dist).toHaveLength(1);
      expect(dist[0].customerId).toBe(CUSTOMER.HOSPITAL);
      expect(dist[0].customerName).toBe(CUSTOMER_NAME);
      expect(dist[0].lotId).toBe(LOT.A);
      expect(dist[0].quantityDistributed).toBe(600);
    });
  });

  describe('roll-up into the recall', () => {
    it('notification returned qty rolls up to recall.returnedQuantity', async () => {
      const recall = await recallForLotA();
      await startRecall(recall.id, USER.COORDINATOR);
      const notif = await createNotification(
        recall.id,
        { customerId: CUSTOMER.HOSPITAL, notificationMethod: 'phone' },
        USER.COORDINATOR,
      );
      // notification pre-fills the distributed qty for this customer
      expect(notif.quantityDistributed).toBe(600);

      await updateNotification(
        notif.id,
        { responseStatus: 'returned', quantityReturned: 500 },
        USER.COORDINATOR,
      );

      const details = await getRecallDetails(recall.id);
      expect(details!.returnedQuantity).toBe(500);
    });

    it('reconciliation computes unaccounted and effectiveness exactly', async () => {
      const recall = await recallForLotA(); // distributed 600
      await startRecall(recall.id, USER.COORDINATOR);

      const rec = await recordReconciliation(
        recall.id,
        { lotId: LOT.A, returnedQty: 400, destroyedQty: 100, accountedQty: 50 },
        USER.QA,
      );
      expect(rec.distributedQty).toBe(600);
      expect(rec.unaccountedQty).toBe(50); // 600 - (400+100+50)

      const details = await getRecallDetails(recall.id);
      expect(details!.reconciledQuantity).toBe(550);
      expect(details!.effectivenessRate).toBeCloseTo((550 / 600) * 100, 4);
    });

    it('re-recording the same lot updates in place (no duplicate row)', async () => {
      const recall = await recallForLotA();
      await startRecall(recall.id, USER.COORDINATOR);

      await recordReconciliation(recall.id, { lotId: LOT.A, returnedQty: 300 }, USER.QA);
      await recordReconciliation(recall.id, { lotId: LOT.A, returnedQty: 600 }, USER.QA);

      const details = await getRecallDetails(recall.id);
      expect(details!.reconciliation.filter((r) => r.lotId === LOT.A)).toHaveLength(1);
      expect(details!.reconciledQuantity).toBe(600);
      expect(details!.effectivenessRate).toBeCloseTo(100, 4);
    });
  });
});
