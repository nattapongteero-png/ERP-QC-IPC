/**
 * Sales Service Integration Tests
 * Feature: 014-unit-cost
 *
 * Tests execute real database queries against SQLite to catch schema mismatch bugs.
 * Focus: Verify all SQL queries work without schema errors.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

// Hoisted getter/setter for test database
const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
});

// Mock the database module BEFORE importing the service
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock inventory service functions
vi.mock('@/lib/services/inventory.service', () => ({
  getLotsForPicking: vi.fn().mockResolvedValue({ allocated: [], remaining: 0 }),
  reserveLots: vi.fn().mockResolvedValue(undefined),
  issueMaterial: vi.fn().mockResolvedValue(undefined),
}));

// Mock accounting service functions
vi.mock('@/lib/services/accounting.service', () => ({
  createSOShipmentJournalEntry: vi.fn().mockResolvedValue({
    salesJournalEntryId: 1,
    salesJournalEntryNumber: 'JE-001',
    cogsJournalEntryId: 2,
    cogsJournalEntryNumber: 'JE-002',
    message: 'Journal entries created',
  }),
  createARInvoiceFromSOShipment: vi.fn().mockResolvedValue({
    arInvoiceId: 1,
    arInvoiceNumber: 'AR-001',
    taxInvoiceNumber: 'TAX-001',
    message: 'AR Invoice created',
  }),
  THAI_VAT_RATE: 0.07,
}));

// Mock unit-cost service functions
vi.mock('@/lib/services/unit-cost.service', () => ({
  calculateCOGS: vi.fn().mockResolvedValue({
    totalCost: 500,
    unitCost: 50,
    marginAmount: 500,
    marginPercent: 50,
  }),
  updateSOLineWithCOGS: vi.fn().mockResolvedValue(undefined),
}));

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../../helpers/test-db';
import { seedTestUser } from '../../../helpers/service-test-seeds';
import { getSqliteDate } from '../../../helpers/service-test-utils';

// Now import the service (after mock is set up)
import {
  checkATP,
  createSalesOrder,
  allocateLotsForOrder,
  fulfillSalesOrderLine,
} from '@/lib/services/sales.service';

describe('Sales Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteSalesOrders,
      schema.sqliteSalesOrderLines,
      schema.sqliteSalesDeliveries,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    // Clean tables before each test (in FK order)
    cleanTables(sqlite, [
      'sales_deliveries',
      'sales_order_lines',
      'sales_orders',
      'inventory_lots',
      'warehouse_locations',
      'warehouses',
      'items',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helpers
  function seedItems() {
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
      VALUES
        (1, 'FG001', 'ผลิตภัณฑ์สมุนไพร A', 'Herbal Product A', 'finished_good', 'capsule', 'BOX', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'FG002', 'ผลิตภัณฑ์สมุนไพร B', 'Herbal Product B', 'finished_good', 'tablet', 'BOX', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedWarehouseAndLots() {
    seedItems();
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at)
      VALUES (1, 1, 'LOC-A1', 'Location A1', 1, '${getSqliteDate()}')
    `);
    // Released inventory lots (available for sale)
    sqlite.exec(`
      INSERT INTO inventory_lots (id, lot_number, item_id, warehouse_id, location_id, quantity, reserved_quantity, unit, status, manufacturing_date, expiry_date, created_at, updated_at)
      VALUES
        (1, 'LOT-2024-001', 1, 1, 1, 100, 0, 'BOX', 'released', '2024-01-01', '2025-12-31', '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'LOT-2024-002', 1, 1, 1, 50, 20, 'BOX', 'released', '2024-02-01', '2025-11-30', '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 'LOT-2024-003', 2, 1, 1, 200, 0, 'BOX', 'released', '2024-01-15', '2026-01-15', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedSalesOrder() {
    seedWarehouseAndLots();
    sqlite.exec(`
      INSERT INTO sales_orders (id, so_number, customer_name, customer_contact, customer_address, status, order_date, total_amount, currency, created_by, created_at, updated_at)
      VALUES (1, 'SO-202401-0001', 'โรงพยาบาลสมุนไพร', '02-123-4567', '123 ถนนสุขุมวิท กรุงเทพฯ', 'draft', '2024-01-15', 10000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
      VALUES
        (1, 1, 1, 10, 0, 0, 'BOX', 500, 5000, '${getSqliteDate()}'),
        (2, 1, 2, 10, 0, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
    `);
  }

  function seedConfirmedSalesOrder() {
    seedWarehouseAndLots();
    sqlite.exec(`
      INSERT INTO sales_orders (id, so_number, customer_name, customer_contact, customer_address, status, order_date, total_amount, currency, created_by, created_at, updated_at)
      VALUES (1, 'SO-202401-0001', 'โรงพยาบาลสมุนไพร', '02-123-4567', '123 ถนนสุขุมวิท กรุงเทพฯ', 'confirmed', '2024-01-15', 10000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
      VALUES
        (1, 1, 1, 10, 0, 0, 'BOX', 500, 5000, '${getSqliteDate()}'),
        (2, 1, 2, 10, 0, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
    `);
  }

  describe('checkATP', () => {
    it('should query without schema errors', async () => {
      seedWarehouseAndLots();

      const result = await checkATP(1, 10);

      expect(result).toBeDefined();
      expect(typeof result.availableNow).toBe('number');
    });

    it('should return correct ATP for available stock', async () => {
      seedWarehouseAndLots();

      const result = await checkATP(1, 50);

      expect(result.itemId).toBe(1);
      expect(result.itemCode).toBe('FG001');
      expect(result.requestedQuantity).toBe(50);
      // Item 1: Lot 1 has 100 (0 reserved), Lot 2 has 50 (20 reserved)
      // Available = 100 + 30 = 130
      expect(result.availableNow).toBe(130);
      expect(result.canFulfill).toBe(true);
      expect(result.shortfall).toBe(0);
    });

    it('should detect shortfall when insufficient stock', async () => {
      seedWarehouseAndLots();

      const result = await checkATP(1, 200);

      expect(result.canFulfill).toBe(false);
      expect(result.shortfall).toBe(70); // 200 - 130 = 70
    });

    it('should return breakdown information', async () => {
      seedWarehouseAndLots();

      const result = await checkATP(1, 10);

      expect(result.breakdown).toHaveProperty('onHand');
      expect(result.breakdown).toHaveProperty('reserved');
      expect(result.breakdown).toHaveProperty('incoming');
      expect(result.breakdown).toHaveProperty('committed');
    });

    it('should throw error for non-existent item', async () => {
      seedItems();

      await expect(checkATP(999, 10)).rejects.toThrow('Item 999 not found');
    });
  });

  describe('createSalesOrder', () => {
    it('should insert without schema errors', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Test Customer', contact: '081-234-5678', address: 'Bangkok' },
        [{ itemId: 1, quantity: 10, unitPrice: 500, requiredDate: '2024-02-01' }],
        1
      );

      expect(result).toBeDefined();
      expect(result.orderId).toBeGreaterThan(0);
    });

    it('should generate SO number automatically', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Hospital A' },
        [{ itemId: 1, quantity: 5, unitPrice: 500, requiredDate: '2024-02-01' }],
        1
      );

      const so = sqlite.prepare('SELECT so_number FROM sales_orders WHERE id = ?').get(result.orderId) as { so_number: string };
      expect(so.so_number).toMatch(/^SO-\d{6}-\d{4}$/);
    });

    it('should set initial status to draft', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Clinic B' },
        [{ itemId: 1, quantity: 5, unitPrice: 500, requiredDate: '2024-02-01' }],
        1
      );

      const so = sqlite.prepare('SELECT status FROM sales_orders WHERE id = ?').get(result.orderId) as { status: string };
      expect(so.status).toBe('draft');
    });

    it('should calculate total amount correctly', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Pharmacy C' },
        [
          { itemId: 1, quantity: 10, unitPrice: 500, requiredDate: '2024-02-01' },
          { itemId: 2, quantity: 20, unitPrice: 300, requiredDate: '2024-02-01' },
        ],
        1
      );

      const so = sqlite.prepare('SELECT total_amount FROM sales_orders WHERE id = ?').get(result.orderId) as { total_amount: number };
      expect(so.total_amount).toBe(11000); // 10*500 + 20*300
    });

    it('should create order lines', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Distributor D' },
        [
          { itemId: 1, quantity: 10, unitPrice: 500, requiredDate: '2024-02-01' },
          { itemId: 2, quantity: 5, unitPrice: 600, requiredDate: '2024-02-01' },
        ],
        1
      );

      const lines = sqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ?').all(result.orderId) as Array<Record<string, unknown>>;
      expect(lines.length).toBe(2);
    });

    it('should return ATP results for each line', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Hospital E' },
        [
          { itemId: 1, quantity: 50, unitPrice: 500, requiredDate: '2024-02-01' },
          { itemId: 2, quantity: 100, unitPrice: 300, requiredDate: '2024-02-01' },
        ],
        1
      );

      expect(result.atpResults).toHaveLength(2);
      expect(result.atpResults[0].itemId).toBe(1);
      expect(result.atpResults[1].itemId).toBe(2);
    });

    it('should throw error if customer name is missing', async () => {
      seedWarehouseAndLots();

      await expect(
        createSalesOrder(
          { name: '' },
          [{ itemId: 1, quantity: 10, unitPrice: 500, requiredDate: '2024-02-01' }],
          1
        )
      ).rejects.toThrow('Customer name is required');
    });
  });

  describe('allocateLotsForOrder', () => {
    it('should query without schema errors', async () => {
      seedConfirmedSalesOrder();

      const result = await allocateLotsForOrder(1, 1);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
    });

    it('should throw error for non-existent order', async () => {
      await expect(allocateLotsForOrder(999, 1)).rejects.toThrow('Sales Order 999 not found');
    });

    it('should throw error for non-confirmed order', async () => {
      seedSalesOrder(); // Creates draft order

      await expect(allocateLotsForOrder(1, 1)).rejects.toThrow('Sales Order must be Confirmed');
    });

    it('should update order status to processing', async () => {
      seedConfirmedSalesOrder();

      await allocateLotsForOrder(1, 1);

      const so = sqlite.prepare('SELECT status FROM sales_orders WHERE id = 1').get() as { status: string };
      expect(so.status).toBe('processing');
    });
  });

  describe('fulfillSalesOrderLine', () => {
    it('should insert delivery without schema errors', async () => {
      // Seed a processing order
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      const result = await fulfillSalesOrderLine(
        {
          soId: 1,
          soLineId: 1,
          itemId: 1,
          lotId: 1,
          quantity: 5,
        },
        1
      );

      expect(result).toBeDefined();
      expect(result.deliveryId).toBeGreaterThan(0);
    });

    it('should generate delivery number', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      const result = await fulfillSalesOrderLine(
        { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 5 },
        1
      );

      expect(result.deliveryNumber).toMatch(/^DL-\d{6}-\d{4}$/);
    });

    it('should update shipped quantity on SO line', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      await fulfillSalesOrderLine(
        { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 5 },
        1
      );

      const line = sqlite.prepare('SELECT shipped_quantity FROM sales_order_lines WHERE id = 1').get() as { shipped_quantity: number };
      expect(line.shipped_quantity).toBe(5);
    });

    it('should throw error if quantity exceeds pending', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 8, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      await expect(
        fulfillSalesOrderLine(
          { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 5 },
          1
        )
      ).rejects.toThrow('Quantity 5 exceeds pending quantity 2');
    });

    it('should throw error for non-existent line', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);

      await expect(
        fulfillSalesOrderLine(
          { soId: 1, soLineId: 999, itemId: 1, lotId: 1, quantity: 5 },
          1
        )
      ).rejects.toThrow('Sales order line 999 not found for order 1');
    });

    it('should throw error for non-existent lot', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      await expect(
        fulfillSalesOrderLine(
          { soId: 1, soLineId: 1, itemId: 1, lotId: 999, quantity: 5 },
          1
        )
      ).rejects.toThrow('Lot 999 not found');
    });

    it('should return accounting integration results', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      const result = await fulfillSalesOrderLine(
        { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 5 },
        1
      );

      // These are returned from mocked accounting service
      expect(result).toHaveProperty('salesJournalEntryId');
      expect(result).toHaveProperty('cogsJournalEntryId');
      expect(result).toHaveProperty('arInvoiceId');
    });

    it('should update SO status to shipped when all lines shipped', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test Customer', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      // Ship full quantity
      await fulfillSalesOrderLine(
        { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 10 },
        1
      );

      const so = sqlite.prepare('SELECT status FROM sales_orders WHERE id = 1').get() as { status: string };
      expect(so.status).toBe('shipped');
    });
  });

  describe('Schema Validation', () => {
    it('should handle all sales order columns correctly', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        {
          name: 'Full Schema Test Hospital',
          contact: '02-999-8888',
          address: '456 Test Road, Bangkok 10100',
        },
        [{ itemId: 1, quantity: 5, unitPrice: 1000, requiredDate: '2024-03-01' }],
        1
      );

      const so = sqlite.prepare('SELECT * FROM sales_orders WHERE id = ?').get(result.orderId) as Record<string, unknown>;

      expect(so).toHaveProperty('id');
      expect(so).toHaveProperty('so_number');
      expect(so).toHaveProperty('customer_name');
      expect(so).toHaveProperty('customer_contact');
      expect(so).toHaveProperty('customer_address');
      expect(so).toHaveProperty('status');
      expect(so).toHaveProperty('total_amount');
      expect(so).toHaveProperty('currency');
      expect(so).toHaveProperty('created_by');
      expect(so).toHaveProperty('created_at');
      expect(so).toHaveProperty('updated_at');
    });

    it('should handle all sales order line columns correctly', async () => {
      seedWarehouseAndLots();

      const result = await createSalesOrder(
        { name: 'Line Schema Test' },
        [{ itemId: 1, quantity: 10, unitPrice: 500, requiredDate: '2024-03-01' }],
        1
      );

      const line = sqlite.prepare('SELECT * FROM sales_order_lines WHERE so_id = ?').get(result.orderId) as Record<string, unknown>;

      expect(line).toHaveProperty('id');
      expect(line).toHaveProperty('so_id');
      expect(line).toHaveProperty('item_id');
      expect(line).toHaveProperty('quantity');
      expect(line).toHaveProperty('allocated_quantity');
      expect(line).toHaveProperty('shipped_quantity');
      expect(line).toHaveProperty('unit');
      expect(line).toHaveProperty('unit_price');
      expect(line).toHaveProperty('total_price');
    });

    it('should handle all sales delivery columns correctly', async () => {
      seedWarehouseAndLots();
      sqlite.exec(`
        INSERT INTO sales_orders (id, so_number, customer_name, status, total_amount, currency, created_by, created_at, updated_at)
        VALUES (1, 'SO-202401-0001', 'Test', 'confirmed', 5000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
      sqlite.exec(`
        INSERT INTO sales_order_lines (id, so_id, item_id, quantity, allocated_quantity, shipped_quantity, unit, unit_price, total_price, created_at)
        VALUES (1, 1, 1, 10, 10, 0, 'BOX', 500, 5000, '${getSqliteDate()}')
      `);

      const result = await fulfillSalesOrderLine(
        { soId: 1, soLineId: 1, itemId: 1, lotId: 1, quantity: 5, notes: 'Test delivery' },
        1
      );

      const delivery = sqlite.prepare('SELECT * FROM sales_deliveries WHERE id = ?').get(result.deliveryId) as Record<string, unknown>;

      expect(delivery).toHaveProperty('id');
      expect(delivery).toHaveProperty('so_id');
      expect(delivery).toHaveProperty('so_line_id');
      expect(delivery).toHaveProperty('item_id');
      expect(delivery).toHaveProperty('lot_id');
      expect(delivery).toHaveProperty('lot_number');
      expect(delivery).toHaveProperty('quantity');
      expect(delivery).toHaveProperty('unit');
      expect(delivery).toHaveProperty('delivery_date');
      expect(delivery).toHaveProperty('delivery_number');
      expect(delivery).toHaveProperty('status');
      expect(delivery).toHaveProperty('notes');
      expect(delivery).toHaveProperty('created_by');
      expect(delivery).toHaveProperty('created_at');
    });
  });
});
