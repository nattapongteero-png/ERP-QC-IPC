/**
 * Sales Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 6 - การกระจายสินค้า)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete sales module functionality with real-world scenarios.
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

// Mock the database module - need to mock both db() and getSqliteDb()
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    db: () => testDb,
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
  checkATP,
  createSalesOrder,
  allocateLotsForOrder,
  CustomerDetails,
} from '@/lib/services/sales.service';

// Import inventory for seeding
import { receiveMaterial, updateLotStatus, reserveLots } from '@/lib/services/inventory.service';

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
const TODAY = new Date().toISOString().split('T')[0];
const FUTURE_DATE = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

describe('Sales Service Real Integration Tests', () => {
  beforeAll(() => {
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create all required tables using schema sync
    const tables = [
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteCustomers,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteSalesOrders,
      schema.sqliteSalesOrderLines,
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
    // Clean up tables before each test (reverse order of creation for FK)
    sqlite.exec('DELETE FROM sales_order_lines');
    sqlite.exec('DELETE FROM sales_orders');
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM warehouse_locations');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM customers');
    sqlite.exec('DELETE FROM vendors');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (1, 'sales@test.com', 'hash', 'Sales User', 'sales', 1)
    `);

    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active)
      VALUES (1, 'VEN-001', 'Supplier A', 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO customers (id, code, name, phone, email, address, customer_type, is_active)
      VALUES
        (1, 'CUST-001', 'Hospital A', '021111111', 'hospital.a@test.com', '123 Hospital Rd', 'hospital', 1),
        (2, 'CUST-002', 'Pharmacy B', '022222222', 'pharmacy.b@test.com', '456 Pharmacy St', 'pharmacy', 1)
    `);

    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES
        (1, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1),
        (2, 'FG-002', 'ขมิ้นชันแคปซูล', 'Turmeric Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1),
        (2, 'WH-QA', 'Quarantine Area', 'quarantine', 1)
    `);
  });

  // ============================================
  // ATP Calculation Tests
  // ============================================
  describe('Available to Promise (ATP) Calculation', () => {
    it('should calculate ATP when stock is available', async () => {
      // Create and release finished goods lot
      const lotId = await receiveMaterial(1, 'LOT-FG-001', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const atpResult = await checkATP(1, 50);

      expect(atpResult.itemCode).toBe('FG-001');
      expect(atpResult.requestedQuantity).toBe(50);
      expect(atpResult.availableNow).toBe(100);
      expect(atpResult.canFulfill).toBe(true);
      expect(atpResult.shortfall).toBe(0);
    });

    it('should show shortfall when insufficient stock', async () => {
      const lotId = await receiveMaterial(1, 'LOT-FG-002', 30, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const atpResult = await checkATP(1, 50);

      expect(atpResult.canFulfill).toBe(false);
      expect(atpResult.shortfall).toBe(20);
      expect(atpResult.availableNow).toBe(30);
    });

    it('should exclude reserved quantity from available', async () => {
      const lotId = await receiveMaterial(1, 'LOT-FG-003', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      // Reserve some inventory
      await reserveLots(
        [{ lotId, lotNumber: 'LOT-FG-003', quantity: 40, expiryDate: FUTURE_DATE }],
        'SO', 1, TEST_USER_ID
      );

      const atpResult = await checkATP(1, 50);

      expect(atpResult.breakdown.onHand).toBe(100);
      expect(atpResult.breakdown.reserved).toBe(40);
      expect(atpResult.availableNow).toBe(60);
      expect(atpResult.canFulfill).toBe(true);
    });

    it('should only count released lots in ATP', async () => {
      // Create released lot
      const releasedLot = await receiveMaterial(1, 'LOT-REL', 50, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(releasedLot, 'released', TEST_USER_ID);

      // Create quarantine lot
      await receiveMaterial(1, 'LOT-QA', 100, 'box', 2, FUTURE_DATE, null, null, TEST_USER_ID);
      // Keep in quarantine

      const atpResult = await checkATP(1, 100);

      expect(atpResult.availableNow).toBe(50);
      expect(atpResult.canFulfill).toBe(false);
      expect(atpResult.shortfall).toBe(50);
    });
  });

  // ============================================
  // Sales Order Creation Tests
  // ============================================
  describe('Sales Order Creation', () => {
    it('should create sales order with ATP check', async () => {
      // Set up stock
      const lotId = await receiveMaterial(1, 'LOT-SO-001', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const customer: CustomerDetails = {
        name: 'Hospital A',
        contact: '021111111',
        address: '123 Hospital Rd',
      };

      const result = await createSalesOrder(
        customer,
        [{ itemId: 1, quantity: 50, unitPrice: 150, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      expect(result.orderId).toBeGreaterThan(0);
      expect(result.atpResults.length).toBe(1);
      expect(result.atpResults[0].canFulfill).toBe(true);

      // Verify SO was created
      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.so_number).toMatch(/^SO-\d{6}-\d{4}$/);
      expect(so.customer_name).toBe('Hospital A');
      expect(so.customer_address).toBe('123 Hospital Rd');
      expect(so.status).toBe('draft');
      expect(so.total_amount).toBe(7500); // 50 * 150
    });

    it('should create sales order with multiple lines', async () => {
      // Set up stock for both items
      const lot1 = await receiveMaterial(1, 'LOT-M-001', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      const lot2 = await receiveMaterial(2, 'LOT-M-002', 80, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lot1, 'released', TEST_USER_ID);
      await updateLotStatus(lot2, 'released', TEST_USER_ID);

      const customer: CustomerDetails = {
        name: 'Pharmacy B',
        contact: '022222222',
        address: '456 Pharmacy St',
      };

      const result = await createSalesOrder(
        customer,
        [
          { itemId: 1, quantity: 30, unitPrice: 150, requiredDate: FUTURE_DATE },
          { itemId: 2, quantity: 20, unitPrice: 180, requiredDate: FUTURE_DATE },
        ],
        TEST_USER_ID
      );

      expect(result.orderId).toBeGreaterThan(0);
      expect(result.atpResults.length).toBe(2);
      expect(result.atpResults.every(r => r.canFulfill)).toBe(true);

      // Verify SO lines
      const lines = sqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ? ORDER BY id').all(result.orderId) as any[];
      expect(lines.length).toBe(2);
      expect(lines[0].item_id).toBe(1);
      expect(lines[0].quantity).toBe(30);
      expect(lines[1].item_id).toBe(2);
      expect(lines[1].quantity).toBe(20);
    });

    it('should show ATP shortfall for unavailable items', async () => {
      // Only partial stock available
      const lotId = await receiveMaterial(1, 'LOT-SHORT', 20, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const customer: CustomerDetails = {
        name: 'Hospital A',
        address: '123 Hospital Rd',
      };

      const result = await createSalesOrder(
        customer,
        [{ itemId: 1, quantity: 50, unitPrice: 150, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      // Order still created but ATP shows shortfall
      expect(result.orderId).toBeGreaterThan(0);
      expect(result.atpResults[0].canFulfill).toBe(false);
      expect(result.atpResults[0].shortfall).toBe(30);
    });

    it('should generate unique SO numbers', async () => {
      const lot = await receiveMaterial(1, 'LOT-SEQ', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lot, 'released', TEST_USER_ID);

      const customer1: CustomerDetails = { name: 'Customer 1', address: 'Address 1' };
      const customer2: CustomerDetails = { name: 'Customer 2', address: 'Address 2' };

      const result1 = await createSalesOrder(
        customer1,
        [{ itemId: 1, quantity: 10, unitPrice: 100, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      const result2 = await createSalesOrder(
        customer2,
        [{ itemId: 1, quantity: 10, unitPrice: 100, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      const so1 = sqlite.prepare('SELECT so_number FROM sales_orders WHERE id = ?').get(result1.orderId) as any;
      const so2 = sqlite.prepare('SELECT so_number FROM sales_orders WHERE id = ?').get(result2.orderId) as any;

      expect(so1.so_number).not.toBe(so2.so_number);
    });
  });

  // ============================================
  // Order Fulfillment Tests
  // ============================================
  describe('Order Fulfillment Workflow', () => {
    it('should reject allocation for non-confirmed order', async () => {
      const lot = await receiveMaterial(1, 'LOT-ALLOC', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lot, 'released', TEST_USER_ID);

      const customer: CustomerDetails = {
        name: 'Hospital A',
        address: '123 Hospital Rd',
      };

      const result = await createSalesOrder(
        customer,
        [{ itemId: 1, quantity: 50, unitPrice: 150, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      // Order is in draft status, should not allocate
      await expect(
        allocateLotsForOrder(result.orderId, TEST_USER_ID)
      ).rejects.toThrow(/Confirmed/);
    });

    it('should allocate lots for confirmed order using FEFO', async () => {
      // Create two lots with different expiry dates
      const nearExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const farExpiryDate = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const nearLot = await receiveMaterial(1, 'LOT-NEAR', 50, 'box', 1, nearExpiryDate, null, null, TEST_USER_ID);
      const farLot = await receiveMaterial(1, 'LOT-FAR', 50, 'box', 1, farExpiryDate, null, null, TEST_USER_ID);
      await updateLotStatus(nearLot, 'released', TEST_USER_ID);
      await updateLotStatus(farLot, 'released', TEST_USER_ID);

      const customer: CustomerDetails = { name: 'Hospital A', address: '123 Hospital Rd' };
      const result = await createSalesOrder(
        customer,
        [{ itemId: 1, quantity: 30, unitPrice: 150, requiredDate: FUTURE_DATE }],
        TEST_USER_ID
      );

      // Update order to confirmed status
      sqlite.exec(`UPDATE sales_orders SET status = 'confirmed' WHERE id = ${result.orderId}`);

      const allocations = await allocateLotsForOrder(result.orderId, TEST_USER_ID);

      expect(allocations.length).toBe(1);
      // FEFO should pick the near-expiry lot first
      expect(allocations[0].allocations[0].lotNumber).toBe('LOT-NEAR');

      // Verify order status updated
      const so = sqlite.prepare('SELECT status FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.status).toBe('processing');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should require customer name', async () => {
      await expect(
        createSalesOrder(
          { name: '', address: 'Address' }, // Empty customer name
          [{ itemId: 1, quantity: 10, unitPrice: 100, requiredDate: FUTURE_DATE }],
          TEST_USER_ID
        )
      ).rejects.toThrow(/Customer name is required/);
    });

    it('should handle non-existent item in ATP check', async () => {
      await expect(checkATP(999, 10)).rejects.toThrow(/Item.*not found/);
    });

    it('should calculate correct total amount', async () => {
      const lot = await receiveMaterial(1, 'LOT-TOTAL', 100, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lot, 'released', TEST_USER_ID);

      const customer: CustomerDetails = { name: 'Test Customer', address: 'Address' };
      const result = await createSalesOrder(
        customer,
        [
          { itemId: 1, quantity: 10, unitPrice: 150, requiredDate: FUTURE_DATE },
          { itemId: 1, quantity: 5, unitPrice: 200, requiredDate: FUTURE_DATE },
        ],
        TEST_USER_ID
      );

      const so = sqlite.prepare('SELECT total_amount FROM sales_orders WHERE id = ?').get(result.orderId) as any;
      expect(so.total_amount).toBe(2500); // (10*150) + (5*200)
    });

    it('should handle non-existent item in sales order line', async () => {
      const customer: CustomerDetails = { name: 'Test Customer', address: 'Address' };
      await expect(
        createSalesOrder(
          customer,
          [{ itemId: 999, quantity: 10, unitPrice: 100, requiredDate: FUTURE_DATE }],
          TEST_USER_ID
        )
      ).rejects.toThrow(/Item.*not found/);
    });

    it('should handle zero quantity in ATP check', async () => {
      const lot = await receiveMaterial(1, 'LOT-ZERO', 50, 'box', 1, FUTURE_DATE, null, null, TEST_USER_ID);
      await updateLotStatus(lot, 'released', TEST_USER_ID);

      const atpResult = await checkATP(1, 0);
      expect(atpResult.canFulfill).toBe(true);
      expect(atpResult.shortfall).toBe(0);
    });
  });
});
