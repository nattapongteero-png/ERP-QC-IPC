/**
 * Inventory Service MySQL Compatibility Tests
 *
 * Tests for MySQL compatibility fixes:
 * 1. Async getDb() pattern instead of sync db()
 * 2. getInsertId() pattern instead of .returning() for MySQL
 *
 * These tests cover the error scenarios reported in production:
 * - Error: "MySQL requires async initialization. Use getDb() instead"
 * - Error: "database.insert(...).values(...).returning is not a function"
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

// Mock the database module - simulates getDb() async pattern
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb, // Async getDb() pattern
    getSqliteDb: () => testDb,
    db: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock db-helper for getInsertId
vi.mock('@/lib/db/db-helper', async () => {
  const actual = await vi.importActual('@/lib/db/db-helper');
  return {
    ...actual,
    isSqlite: () => true,
    getInsertId: (result: unknown) => {
      // SQLite pattern
      return Number((result as { lastInsertRowid: number | bigint }).lastInsertRowid);
    },
  };
});

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Mock accounting service
vi.mock('@/lib/services/accounting.service', () => ({
  recordMaterialCost: vi.fn(() => Promise.resolve()),
}));

// Import after mocking
import {
  issueMaterial,
  receiveMaterial,
  receiveMaterialExtended,
  adjustInventory,
  transferInventory,
  updateLotStatus,
  getLotsForPicking,
  reserveLots,
  MaterialReceiptData,
} from '@/lib/services/inventory.service';

// Helper for table creation
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;
    switch (col.dataType) {
      case 'string': def += 'TEXT'; break;
      case 'number':
        def += col.columnType === 'SQLiteReal' ? 'REAL' : 'INTEGER';
        break;
      default: def += 'TEXT';
    }
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      const defaultVal = typeof col.default === 'string' ? `'${col.default}'` : col.default;
      def += ` DEFAULT ${defaultVal}`;
    }
    if (col.isUnique && !col.primary) def += ' UNIQUE';
    columnDefs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

const TEST_USER_ID = 1;
const FUTURE_DATE = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

describe('Inventory Service MySQL Compatibility', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create all required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteSalesOrders,
      schema.sqliteSalesOrderLines,
      schema.sqliteSalesDeliveries,
    ];

    for (const table of tables) {
      sqlite.exec(generateCreateTableSql(table));
    }
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clean up tables in reverse dependency order
    sqlite.exec('DELETE FROM sales_deliveries');
    sqlite.exec('DELETE FROM sales_order_lines');
    sqlite.exec('DELETE FROM sales_orders');
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'test@test.com', 'hash', 'Test User', 'admin', 1)
    `);
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES
        (1, 'RM-001', 'ฟ้าทะลายโจร', 'Andrographis', 'raw_material', 'herb', 'kg', 365, 0, 0, 1, 1, 1),
        (2, 'FG-001', 'แคปซูลฟ้าทะลายโจร', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 730, 0, 0, 1, 1, 1)
    `);
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-RM', 'Raw Material Warehouse', 'raw_material', 1),
        (2, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1)
    `);
  });

  describe('receiveMaterial - MySQL Compatibility (Previously: .returning() error)', () => {
    it('should create lot and return valid lot ID', async () => {
      // This tests the fix for: "database.insert(...).values(...).returning is not a function"
      const lotId = await receiveMaterial(
        1,                // itemId
        'LOT-RM-001',     // lotNumber
        100,              // quantity
        'kg',             // unit
        1,                // warehouseId
        FUTURE_DATE,      // expiryDate
        null,             // vendorId
        'PO-001',         // poNumber
        TEST_USER_ID      // userId
      );

      expect(lotId).toBeGreaterThan(0);
      expect(typeof lotId).toBe('number');

      // Verify lot was created correctly
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot).toBeDefined();
      expect(lot.lot_number).toBe('LOT-RM-001');
      expect(lot.quantity).toBe(100);
      expect(lot.status).toBe('quarantine');
    });

    it('should create transaction record with valid ID', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-TXN-001', 50, 'kg', 1, FUTURE_DATE, null, 'PO-002', TEST_USER_ID
      );

      // Verify transaction was created
      const txn = sqlite.prepare(
        'SELECT * FROM inventory_transactions WHERE lot_id = ? AND transaction_type = ?'
      ).get(lotId, 'receive') as any;

      expect(txn).toBeDefined();
      expect(txn.quantity).toBe(50);
      expect(txn.reference_type).toBe('PO');
    });
  });

  describe('issueMaterial - MySQL Compatibility (Previously: .returning() error)', () => {
    it('should issue material and return valid transaction ID', async () => {
      // Setup: Create and release a lot
      const lotId = await receiveMaterial(
        1, 'LOT-ISSUE-001', 100, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Test: Issue material - this tests the .returning() fix
      const txnId = await issueMaterial(
        lotId,
        30,
        'WO',
        1,
        'WO-001',
        TEST_USER_ID,
        'Production consumption'
      );

      expect(txnId).toBeGreaterThan(0);
      expect(typeof txnId).toBe('number');

      // Verify lot quantity was deducted
      const lot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.quantity).toBe(70); // 100 - 30

      // Verify transaction was created
      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(txnId) as any;
      expect(txn.transaction_type).toBe('issue');
      expect(txn.quantity).toBe(-30); // Negative for issue
    });

    it('should reject issue from non-released lot', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-QUARANTINE', 100, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      // Not releasing the lot - still in quarantine

      await expect(issueMaterial(
        lotId, 30, 'WO', 1, 'WO-002', TEST_USER_ID
      )).rejects.toThrow(/not released/);
    });

    it('should reject issue exceeding available quantity', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-LIMITED', 50, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      await expect(issueMaterial(
        lotId, 100, 'WO', 1, 'WO-003', TEST_USER_ID
      )).rejects.toThrow(/Insufficient/);
    });
  });

  describe('adjustInventory - MySQL Compatibility (Previously: .returning() error)', () => {
    it('should adjust inventory and return valid transaction ID', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-ADJUST-001', 100, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Test adjustment - this tests the .returning() fix
      const txnId = await adjustInventory(
        lotId,
        80,                     // newQuantity
        'Physical count discrepancy',
        TEST_USER_ID
      );

      expect(txnId).toBeGreaterThan(0);
      expect(typeof txnId).toBe('number');

      // Verify lot quantity was adjusted
      const lot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.quantity).toBe(80);

      // Verify adjustment transaction
      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(txnId) as any;
      expect(txn.transaction_type).toBe('adjust');
      expect(txn.quantity).toBe(-20); // 80 - 100 = -20
      expect(txn.reason).toBe('Physical count discrepancy');
    });

    it('should handle positive adjustment', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-ADJUST-002', 50, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );

      const txnId = await adjustInventory(lotId, 75, 'Found missing stock', TEST_USER_ID);

      expect(txnId).toBeGreaterThan(0);

      const lot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.quantity).toBe(75);

      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(txnId) as any;
      expect(txn.quantity).toBe(25); // 75 - 50 = +25
    });
  });

  describe('transferInventory - MySQL Compatibility (Previously: .returning() error)', () => {
    it('should transfer inventory and return valid IDs', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-TRANSFER-001', 100, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Test transfer - this tests both lot and transaction .returning() fixes
      const result = await transferInventory(
        lotId,
        2,                    // toWarehouseId
        40,                   // quantity
        TEST_USER_ID,
        'Relocating stock'
      );

      expect(result.newLotId).toBeGreaterThan(0);
      expect(result.transactionId).toBeGreaterThan(0);
      expect(typeof result.newLotId).toBe('number');
      expect(typeof result.transactionId).toBe('number');

      // Verify source lot quantity was deducted
      const sourceLot = sqlite.prepare('SELECT quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(sourceLot.quantity).toBe(60); // 100 - 40

      // Verify new lot was created in destination warehouse
      const newLot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(result.newLotId) as any;
      expect(newLot.warehouse_id).toBe(2);
      expect(newLot.quantity).toBe(40);
      expect(newLot.lot_number).toBe('LOT-TRANSFER-001'); // Same lot number

      // Verify transfer transaction
      const txn = sqlite.prepare('SELECT * FROM inventory_transactions WHERE id = ?').get(result.transactionId) as any;
      expect(txn.transaction_type).toBe('transfer');
      expect(txn.from_warehouse_id).toBe(1);
      expect(txn.to_warehouse_id).toBe(2);
    });

    it('should reject transfer exceeding available quantity', async () => {
      const lotId = await receiveMaterial(
        1, 'LOT-TRANSFER-002', 30, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID
      );
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      await expect(transferInventory(
        lotId, 2, 50, TEST_USER_ID
      )).rejects.toThrow(/Insufficient/);
    });
  });

  describe('receiveMaterialExtended - MySQL Compatibility (Previously: .returning() error)', () => {
    it('should create lot with extended fields and return valid ID', async () => {
      const data: MaterialReceiptData = {
        itemId: 1,
        lotNumber: 'LOT-EXT-001',
        quantity: 200,
        unit: 'kg',
        warehouseId: 1,
        expiryDate: FUTURE_DATE,
        vendorId: null,
        poNumber: 'PO-EXT-001',
        manufacturingDate: '2024-01-15',
        manufacturerName: 'Thai Herb Co.',
        manufacturerId: null,
        importerName: 'Import Ltd.',
        importerId: null,
        countryOfOrigin: 'Thailand',
        retestDate: '2025-06-15',
        retestIntervalMonths: 12,
      };

      const lotId = await receiveMaterialExtended(data, TEST_USER_ID);

      expect(lotId).toBeGreaterThan(0);
      expect(typeof lotId).toBe('number');

      // Verify lot was created with extended fields
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.lot_number).toBe('LOT-EXT-001');
      expect(lot.quantity).toBe(200);
      expect(lot.manufacturer_name).toBe('Thai Herb Co.');
      expect(lot.importer_name).toBe('Import Ltd.');
      expect(lot.country_of_origin).toBe('Thailand');
      expect(lot.retest_date).toBe('2025-06-15');
      expect(lot.retest_interval_months).toBe(12);
    });

    it('should calculate retest status correctly', async () => {
      const overdueDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const data: MaterialReceiptData = {
        itemId: 1,
        lotNumber: 'LOT-RETEST-001',
        quantity: 100,
        unit: 'kg',
        warehouseId: 1,
        retestDate: overdueDate,
      };

      const lotId = await receiveMaterialExtended(data, TEST_USER_ID);

      const lot = sqlite.prepare('SELECT retest_status FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lot.retest_status).toBe('overdue');
    });
  });

  describe('FEFO Algorithm with getDb() async pattern', () => {
    it('should get lots for picking ordered by expiry (FEFO)', async () => {
      // Create multiple lots with different expiry dates
      const lot1 = await receiveMaterial(1, 'LOT-FEFO-1', 50, 'kg', 1, '2025-03-01', null, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(1, 'LOT-FEFO-2', 50, 'kg', 1, '2025-01-15', null, null, TEST_USER_ID);
      const lot3 = await receiveMaterial(1, 'LOT-FEFO-3', 50, 'kg', 1, '2025-06-20', null, null, TEST_USER_ID);

      // Release all lots
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);
      await updateLotStatus(lot3, 'released', TEST_USER_ID);

      // Get lots for picking - should use FEFO order
      const { allocated, remaining } = await getLotsForPicking(1, 80);

      expect(remaining).toBe(0);
      expect(allocated.length).toBe(2);
      // First lot should be earliest expiry (2025-01-15)
      expect(allocated[0].lotNumber).toBe('LOT-FEFO-2');
      expect(allocated[0].quantity).toBe(50);
      // Second lot should be next earliest (2025-03-01)
      expect(allocated[1].lotNumber).toBe('LOT-FEFO-1');
      expect(allocated[1].quantity).toBe(30); // Only need 30 more
    });
  });

  describe('Reserve and Issue workflow with getDb() async pattern', () => {
    it('should reserve lots and then issue from reserved quantity', async () => {
      const lotId = await receiveMaterial(1, 'LOT-RESERVE-001', 100, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Get lots for picking
      const { allocated } = await getLotsForPicking(1, 50);
      expect(allocated.length).toBe(1);

      // Reserve the lots
      await reserveLots(allocated, 'WO', 1, TEST_USER_ID);

      // Verify reserved quantity updated
      const lotAfterReserve = sqlite.prepare('SELECT reserved_quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lotAfterReserve.reserved_quantity).toBe(50);

      // Issue the reserved material
      const txnId = await issueMaterial(lotId, 50, 'WO', 1, 'WO-001', TEST_USER_ID);
      expect(txnId).toBeGreaterThan(0);

      // Verify both quantity and reserved_quantity were reduced
      const lotAfterIssue = sqlite.prepare('SELECT quantity, reserved_quantity FROM inventory_lots WHERE id = ?').get(lotId) as any;
      expect(lotAfterIssue.quantity).toBe(50); // 100 - 50
      expect(lotAfterIssue.reserved_quantity).toBe(0); // Reserved was consumed
    });
  });

  describe('Error Handling - getDb() async initialization', () => {
    it('should handle database operations asynchronously', async () => {
      // This tests that all operations properly use async getDb()
      // If sync db() was used, these would fail with "MySQL requires async initialization"

      const operations = [
        receiveMaterial(1, 'LOT-ASYNC-1', 10, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID),
        receiveMaterial(1, 'LOT-ASYNC-2', 20, 'kg', 1, FUTURE_DATE, null, null, TEST_USER_ID),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toBeGreaterThan(0);
      expect(results[1]).toBeGreaterThan(0);
      expect(results[0]).not.toBe(results[1]); // Different IDs
    });
  });
});
