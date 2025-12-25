/**
 * Inventory Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5 - สถานที่เก็บรักษา)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete inventory module functionality with real-world scenarios.
 *
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module to use our test database
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service after mocking
import {
  receiveMaterial,
  updateLotStatus,
  issueMaterial,
  adjustInventory,
  transferInventory,
  getLotsForPicking,
  reserveLots,
  getStockSummary,
  checkExpiryAlerts,
  recalculateItemOnHand,
  traceForward,
  traceBackward,
} from '@/lib/services/inventory.service';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;

    // Map data type
    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        if (col.columnType === 'SQLiteReal') {
          def += 'REAL';
        } else {
          def += 'INTEGER';
        }
        break;
      case 'boolean':
        def += 'INTEGER';
        break;
      default:
        def += 'TEXT';
    }

    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    if (col.notNull && !col.primary) {
      def += ' NOT NULL';
    }

    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string'
        ? `'${col.default}'`
        : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }

    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

// Test data constants
const TEST_USER_ID = 1;
const TEST_USER_ID_2 = 2;
const TODAY = new Date().toISOString().split('T')[0];
const FUTURE_DATE = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 180 days
const NEAR_EXPIRY_DATE = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 15 days
const PAST_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days ago

describe('Inventory Service Real Integration Tests', () => {
  beforeAll(() => {
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create all required tables using schema sync
    const tables = [
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteBOM,
      schema.sqliteWorkOrders,
    ];

    for (const table of tables) {
      const sql = generateCreateTableSql(table);
      sqlite.exec(sql);
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clean up tables before each test
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM work_orders');
    sqlite.exec('DELETE FROM bom');
    sqlite.exec('DELETE FROM warehouse_locations');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM vendors');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES
        (1, 'warehouse@test.com', 'hash', 'Warehouse User', 'warehouse_staff', 1),
        (2, 'qa@test.com', 'hash', 'QA User', 'quality_assurance', 1)
    `);

    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active)
      VALUES
        (1, 'VEN-001', 'Approved Herb Supplier', 1, 1),
        (2, 'VEN-002', 'Packaging Supplier', 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES
        (1, 'RM-001', 'ฟ้าทะลายโจร', 'Andrographis', 'raw_material', 'herb', 'kg', 365, 0, 0, 1, 1, 1),
        (2, 'RM-002', 'ขมิ้นชัน', 'Turmeric', 'raw_material', 'herb', 'kg', 365, 0, 0, 1, 1, 1),
        (3, 'PM-001', 'ขวดแก้ว 100 ml', 'Glass Bottle 100ml', 'packaging', 'container', 'pcs', 730, 0, 0, 1, 0, 1),
        (4, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-RM', 'Raw Material Warehouse', 'raw_material', 1),
        (2, 'WH-QA', 'Quarantine Area', 'quarantine', 1),
        (3, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1),
        (4, 'WH-REJ', 'Rejected Material Storage', 'rejected', 1)
    `);
  });

  // ============================================
  // SCENARIO 1: Material Receipt with Quarantine -> QC Release
  // ============================================
  describe('Real-World Scenario: Material Receipt and QC Release', () => {
    it('should receive material into quarantine status', async () => {
      const lotId = await receiveMaterial(
        1, // itemId
        'LOT-2024-001',
        100, // quantity
        'kg',
        2, // warehouseId (Quarantine)
        FUTURE_DATE,
        1, // vendorId
        'PO-2024-001',
        TEST_USER_ID
      );

      expect(lotId).toBeGreaterThan(0);

      // Verify lot was created in quarantine
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot).toBeDefined();
      expect(lot.status).toBe('quarantine');
      expect(lot.quantity).toBe(100);
      expect(lot.lot_number).toBe('LOT-2024-001');
    });

    it('should release lot after QC approval', async () => {
      // Receive material
      const lotId = await receiveMaterial(
        1, 'LOT-2024-002', 50, 'kg', 2, FUTURE_DATE, 1, 'PO-2024-002', TEST_USER_ID
      );

      // QC approves and releases
      await updateLotStatus(lotId, 'released', TEST_USER_ID_2, 'QC passed', 'COA-2024-002');

      // Verify status change
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('released');
      expect(lot.coa_number).toBe('COA-2024-002');
    });

    it('should reject lot when QC fails', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-2024-003', 25, 'kg', 2, FUTURE_DATE, 1, 'PO-2024-003', TEST_USER_ID
      );

      await updateLotStatus(lotId, 'rejected', TEST_USER_ID_2, 'Failed assay test');

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('rejected');
    });

    it('should recalculate item on-hand after lot release', async () => {
      // Receive two lots
      const lotId1 = await receiveMaterial(1, 'LOT-A', 100, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lotId2 = await receiveMaterial(1, 'LOT-B', 50, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);

      // Release only first lot
      await updateLotStatus(lotId1, 'released', TEST_USER_ID_2);

      const result = await recalculateItemOnHand(1);
      expect(result.onHand).toBe(100); // Only released lot counts

      // Release second lot
      await updateLotStatus(lotId2, 'released', TEST_USER_ID_2);
      const newResult = await recalculateItemOnHand(1);
      expect(newResult.onHand).toBe(150);
    });
  });

  // ============================================
  // SCENARIO 2: Stock Transactions (Issue, Transfer, Adjust)
  // ============================================
  describe('Real-World Scenario: Stock Transactions', () => {
    let releasedLotId: number;

    beforeEach(async () => {
      // Set up a released lot for transactions
      releasedLotId = await receiveMaterial(
        1, 'LOT-TXN-001', 200, 'kg', 1, FUTURE_DATE, 1, 'PO-TXN-001', TEST_USER_ID
      );
      await updateLotStatus(releasedLotId, 'released', TEST_USER_ID_2);
    });

    it('should issue material from lot', async () => {
      const txnId = await issueMaterial(
        releasedLotId,
        50,
        'WO',
        1,
        'WO-2024-001',
        TEST_USER_ID,
        'Production batch'
      );

      expect(txnId).toBeGreaterThan(0);

      // Verify quantity deducted
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(releasedLotId) as any;
      expect(lot.quantity).toBe(150);

      // Verify transaction recorded
      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(txnId) as any;
      expect(txn.transaction_type).toBe('issue');
      expect(txn.quantity).toBe(-50); // Negative for issue
    });

    it('should prevent issuing from non-released lots', async () => {
      const quarantineLotId = await receiveMaterial(
        2, 'LOT-Q-001', 100, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID
      );

      await expect(
        issueMaterial(quarantineLotId, 10, 'WO', 1, 'WO-X', TEST_USER_ID)
      ).rejects.toThrow(/not released/);
    });

    it('should prevent issuing more than available', async () => {
      await expect(
        issueMaterial(releasedLotId, 300, 'WO', 1, 'WO-Y', TEST_USER_ID)
      ).rejects.toThrow(/Insufficient quantity/);
    });

    it('should transfer inventory between warehouses', async () => {
      const result = await transferInventory(
        releasedLotId,
        3, // FG warehouse
        75,
        TEST_USER_ID,
        'Moving to FG area'
      );

      expect(result.newLotId).toBeGreaterThan(0);
      expect(result.transactionId).toBeGreaterThan(0);

      // Verify source lot quantity reduced
      const sourceLot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(releasedLotId) as any;
      expect(sourceLot.quantity).toBe(125);

      // Verify new lot created in destination warehouse
      const newLot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(result.newLotId) as any;
      expect(newLot.warehouse_id).toBe(3);
      expect(newLot.quantity).toBe(75);
      expect(newLot.lot_number).toBe('LOT-TXN-001'); // Same lot number
    });

    it('should adjust inventory with reason', async () => {
      const txnId = await adjustInventory(
        releasedLotId,
        195, // New quantity (was 200)
        'Cycle count adjustment',
        TEST_USER_ID,
        TEST_USER_ID_2 // Approver
      );

      expect(txnId).toBeGreaterThan(0);

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(releasedLotId) as any;
      expect(lot.quantity).toBe(195);

      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(txnId) as any;
      expect(txn.transaction_type).toBe('adjust');
      expect(txn.quantity).toBe(-5); // Difference
      expect(txn.reason).toBe('Cycle count adjustment');
    });
  });

  // ============================================
  // CRUD Functions Tests
  // ============================================
  describe('Inventory Service CRUD Functions', () => {
    it('should get lots for picking using FEFO algorithm', async () => {
      // Create lots with different expiry dates
      const lot1 = await receiveMaterial(1, 'LOT-FEFO-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'LOT-FEFO-2', 100, 'kg', 1, NEAR_EXPIRY_DATE, 1, null, TEST_USER_ID);
      const lot3 = await receiveMaterial(1, 'LOT-FEFO-3', 100, 'kg', 1,
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 1, null, TEST_USER_ID);

      // Release all lots
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);
      await updateLotStatus(lot3, 'released', TEST_USER_ID);

      // Pick 150 kg - should take from near-expiry first
      const result = await getLotsForPicking(1, 150);

      expect(result.allocated.length).toBeGreaterThanOrEqual(2);
      expect(result.remaining).toBe(0);

      // First allocation should be from near-expiry lot (lot2)
      expect(result.allocated[0].lotNumber).toBe('LOT-FEFO-2');
    });

    it('should reserve lots for orders', async () => {
      const lotId = await receiveMaterial(1, 'LOT-RES-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const allocations = [{ lotId, lotNumber: 'LOT-RES-1', quantity: 30, expiryDate: FUTURE_DATE }];
      const success = await reserveLots(allocations, 'SO', 1, TEST_USER_ID);

      expect(success).toBe(true);

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.reserved_quantity).toBe(30);
    });

    it('should get stock summary for item', async () => {
      // Create lots in different statuses
      const releasedLot = await receiveMaterial(1, 'LOT-S1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(releasedLot, 'released', TEST_USER_ID);

      const quarantineLot = await receiveMaterial(1, 'LOT-S2', 50, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);
      // Keep in quarantine

      const rejectedLot = await receiveMaterial(1, 'LOT-S3', 25, 'kg', 4, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(rejectedLot, 'rejected', TEST_USER_ID);

      // Reserve some
      await reserveLots(
        [{ lotId: releasedLot, lotNumber: 'LOT-S1', quantity: 20, expiryDate: FUTURE_DATE }],
        'SO', 1, TEST_USER_ID
      );

      const summary = await getStockSummary(1);

      expect(summary).not.toBeNull();
      expect(summary!.onHand).toBe(100);
      expect(summary!.reserved).toBe(20);
      expect(summary!.available).toBe(80);
      expect(summary!.quarantine).toBe(50);
      expect(summary!.blocked).toBe(25);
    });
  });

  // ============================================
  // Lot Status Functions Tests
  // ============================================
  describe('Lot Status Functions', () => {
    it('should quarantine lot (initial status)', async () => {
      const lotId = await receiveMaterial(1, 'LOT-STATUS-1', 100, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('quarantine');
    });

    it('should release lot with COA', async () => {
      const lotId = await receiveMaterial(1, 'LOT-REL-1', 100, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID, 'All tests passed', 'COA-REL-001');

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('released');
      expect(lot.coa_number).toBe('COA-REL-001');
    });

    it('should reject lot with reason', async () => {
      const lotId = await receiveMaterial(1, 'LOT-REJ-1', 100, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'rejected', TEST_USER_ID, 'Failed microbial test');

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('rejected');
    });

    it('should block lot for investigation', async () => {
      const lotId = await receiveMaterial(1, 'LOT-BLK-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await updateLotStatus(lotId, 'blocked', TEST_USER_ID, 'Pending deviation investigation');

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.status).toBe('blocked');
    });

    it('should get available stock (released and unreserved)', async () => {
      const lot1 = await receiveMaterial(1, 'LOT-AV-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'LOT-AV-2', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);

      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);

      // Reserve part of lot1
      await reserveLots(
        [{ lotId: lot1, lotNumber: 'LOT-AV-1', quantity: 40, expiryDate: FUTURE_DATE }],
        'SO', 1, TEST_USER_ID
      );

      const summary = await getStockSummary(1);
      expect(summary!.onHand).toBe(200);
      expect(summary!.reserved).toBe(40);
      expect(summary!.available).toBe(160);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should prevent negative stock after issue', async () => {
      const lotId = await receiveMaterial(1, 'LOT-NEG-1', 50, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Try to issue more than available
      await expect(
        issueMaterial(lotId, 60, 'WO', 1, 'WO-NEG', TEST_USER_ID)
      ).rejects.toThrow(/Insufficient quantity/);
    });

    it('should handle lot expiry alerts', async () => {
      // Create lots with various expiry states
      await receiveMaterial(1, 'LOT-EXP-NEAR', 100, 'kg', 1, NEAR_EXPIRY_DATE, 1, null, TEST_USER_ID);
      await receiveMaterial(1, 'LOT-EXP-PAST', 50, 'kg', 1, PAST_DATE, 1, null, TEST_USER_ID);
      await receiveMaterial(1, 'LOT-EXP-OK', 75, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);

      // Release all
      const lots = sqlite.prepare('SELECT id FROM inventory_lots').all() as any[];
      for (const lot of lots) {
        await updateLotStatus(lot.id, 'released', TEST_USER_ID);
      }

      const alerts = await checkExpiryAlerts(30);

      expect(alerts.nearExpiry.length).toBeGreaterThanOrEqual(1);
      expect(alerts.expired.length).toBeGreaterThanOrEqual(1);

      // Near expiry should include the 15-day lot
      const nearExpiryLotNumbers = alerts.nearExpiry.map(l => l.lotNumber);
      expect(nearExpiryLotNumbers).toContain('LOT-EXP-NEAR');

      // Expired should include the past date lot
      const expiredLotNumbers = alerts.expired.map(l => l.lotNumber);
      expect(expiredLotNumbers).toContain('LOT-EXP-PAST');
    });

    it('should handle status blocking (prevent issue from blocked lot)', async () => {
      const lotId = await receiveMaterial(1, 'LOT-BLK-2', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);
      await updateLotStatus(lotId, 'blocked', TEST_USER_ID, 'Under investigation');

      await expect(
        issueMaterial(lotId, 10, 'WO', 1, 'WO-BLK', TEST_USER_ID)
      ).rejects.toThrow(/not released/);
    });

    it('should handle reserved quantity during issue', async () => {
      const lotId = await receiveMaterial(1, 'LOT-RESV-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Reserve 80 kg
      await reserveLots(
        [{ lotId, lotNumber: 'LOT-RESV-1', quantity: 80, expiryDate: FUTURE_DATE }],
        'SO', 1, TEST_USER_ID
      );

      // Try to issue more than unreserved (20 kg available)
      await expect(
        issueMaterial(lotId, 30, 'WO', 1, 'WO-RES', TEST_USER_ID)
      ).rejects.toThrow(/Insufficient quantity/);

      // But can issue up to unreserved amount
      const txnId = await issueMaterial(lotId, 20, 'WO', 1, 'WO-RES-OK', TEST_USER_ID);
      expect(txnId).toBeGreaterThan(0);
    });

    it('should handle transfer with insufficient quantity', async () => {
      const lotId = await receiveMaterial(1, 'LOT-TRF-1', 50, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      await expect(
        transferInventory(lotId, 3, 100, TEST_USER_ID)
      ).rejects.toThrow(/Insufficient quantity/);
    });

    it('should preserve lot attributes during transfer', async () => {
      const lotId = await receiveMaterial(1, 'LOT-ATTR-1', 100, 'kg', 1, FUTURE_DATE, 1, 'PO-ATTR', TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID, 'OK', 'COA-ATTR-001');

      const result = await transferInventory(lotId, 3, 50, TEST_USER_ID);

      const newLot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(result.newLotId) as any;
      expect(newLot.lot_number).toBe('LOT-ATTR-1');
      expect(newLot.expiry_date).toBe(FUTURE_DATE);
      expect(newLot.coa_number).toBe('COA-ATTR-001');
      expect(newLot.po_number).toBe('PO-ATTR');
      expect(newLot.status).toBe('released');
    });
  });

  // ============================================
  // Traceability Functions
  // ============================================
  describe('Traceability Functions', () => {
    it('should trace forward from raw material to product', async () => {
      // Create work order table data if needed - need BOM first
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (1, 'BOM-001', 'Andrographis Capsule BOM', 4, '1.0', 'approved', 1000, 'box')
      `);
      sqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status)
        VALUES (1, 'WO-TRACE-001', 1, 4, 'BATCH-TRACE-001', 500, 'box', 'completed')
      `);

      // Create raw material lot
      const rmLotId = await receiveMaterial(1, 'RM-TRACE-001', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(rmLotId, 'released', TEST_USER_ID);

      // Issue to work order
      await issueMaterial(rmLotId, 50, 'WO', 1, 'WO-TRACE-001', TEST_USER_ID);

      // Create output lot (simulating production)
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status, expiry_date)
        VALUES (100, 4, 'FG-TRACE-001', 'BATCH-001', 3, 500, 0, 'box', 'released', '${FUTURE_DATE}')
      `);
      sqlite.exec(`
        INSERT INTO inventory_transactions (lot_id, transaction_type, quantity, unit, reference_type, reference_id, reference_number, to_warehouse_id, performed_by)
        VALUES (100, 'receive', 500, 'box', 'WO', 1, 'WO-TRACE-001', 3, 1)
      `);

      const trace = await traceForward(rmLotId);

      expect(trace.length).toBeGreaterThanOrEqual(1);
      expect(trace[0].direction).toBe('forward');
      expect(trace[0].lotNumber).toBe('FG-TRACE-001');
    });

    it('should trace backward from product to raw materials', async () => {
      // Set up production chain - need BOM first
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (2, 'BOM-002', 'Andrographis Capsule BOM v2', 4, '1.0', 'approved', 1000, 'box')
      `);
      sqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status)
        VALUES (2, 'WO-BACK-001', 2, 4, 'BATCH-BACK-001', 300, 'box', 'completed')
      `);

      // Create raw material lot
      const rmLotId = await receiveMaterial(1, 'RM-BACK-001', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(rmLotId, 'released', TEST_USER_ID);

      // Issue raw material
      await issueMaterial(rmLotId, 30, 'WO', 2, 'WO-BACK-001', TEST_USER_ID);

      // Create finished product lot
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, warehouse_id, quantity, reserved_quantity, unit, status, expiry_date)
        VALUES (200, 4, 'FG-BACK-001', 'BATCH-002', 3, 300, 0, 'box', 'released', '${FUTURE_DATE}')
      `);
      sqlite.exec(`
        INSERT INTO inventory_transactions (lot_id, transaction_type, quantity, unit, reference_type, reference_id, reference_number, to_warehouse_id, performed_by)
        VALUES (200, 'receive', 300, 'box', 'WO', 2, 'WO-BACK-001', 3, 1)
      `);

      const trace = await traceBackward(200);

      expect(trace.length).toBeGreaterThanOrEqual(1);
      expect(trace[0].direction).toBe('backward');
      expect(trace[0].lotNumber).toBe('RM-BACK-001');
    });

    it('should return empty trace for purchased lots', async () => {
      // Purchased lot has no production work order
      const lotId = await receiveMaterial(1, 'PURCHASED-001', 100, 'kg', 1, FUTURE_DATE, 1, 'PO-123', TEST_USER_ID);

      const trace = await traceBackward(lotId);
      expect(trace).toEqual([]);
    });
  });

  // ============================================
  // Statistics and Reporting
  // ============================================
  describe('Statistics and Reporting', () => {
    it('should calculate correct on-hand quantity', async () => {
      // Create multiple lots for same item
      const lot1 = await receiveMaterial(1, 'LOT-OH-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'LOT-OH-2', 150, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot3 = await receiveMaterial(1, 'LOT-OH-3', 75, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);

      // Release only first two
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);

      const result = await recalculateItemOnHand(1);
      expect(result.onHand).toBe(250); // Only released lots

      // Issue some from lot1
      await issueMaterial(lot1, 25, 'WO', 1, 'WO-OH-1', TEST_USER_ID);

      const newResult = await recalculateItemOnHand(1);
      expect(newResult.onHand).toBe(225);
    });

    it('should provide complete stock summary', async () => {
      // Create diverse inventory state
      const lot1 = await receiveMaterial(1, 'SUM-1', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'SUM-2', 80, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      const lot3 = await receiveMaterial(1, 'SUM-3', 50, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID); // Quarantine
      const lot4 = await receiveMaterial(1, 'SUM-4', 30, 'kg', 4, FUTURE_DATE, 1, null, TEST_USER_ID);

      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);
      // lot3 stays in quarantine
      await updateLotStatus(lot4, 'rejected', TEST_USER_ID);

      // Reserve some stock
      await reserveLots(
        [{ lotId: lot1, lotNumber: 'SUM-1', quantity: 25, expiryDate: FUTURE_DATE }],
        'SO', 1, TEST_USER_ID
      );

      const summary = await getStockSummary(1);

      expect(summary).not.toBeNull();
      expect(summary!.itemCode).toBe('RM-001');
      expect(summary!.onHand).toBe(180); // 100 + 80
      expect(summary!.reserved).toBe(25);
      expect(summary!.available).toBe(155); // 180 - 25
      expect(summary!.quarantine).toBe(50);
      expect(summary!.blocked).toBe(30); // Rejected counts as blocked
      expect(summary!.unit).toBe('kg');
    });
  });
});
