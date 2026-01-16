/**
 * Purchasing Service Integration Tests
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
  checkVendorApproval,
  getPreferredVendor,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
} from '@/lib/services/purchasing.service';

describe('Purchasing Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteVendors,
      schema.sqliteItems,
      schema.sqliteApprovedVendorList,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteInventoryLots,
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
      'inventory_lots',
      'purchase_order_lines',
      'purchase_orders',
      'approved_vendor_list',
      'warehouse_locations',
      'warehouses',
      'items',
      'vendors',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helpers
  function seedVendors() {
    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, payment_terms, created_at, updated_at)
      VALUES
        (1, 'V001', 'Approved Vendor', 1, 1, 'NET30', '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'V002', 'Non-approved Vendor', 0, 1, 'NET30', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedItems() {
    seedVendors();
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
      VALUES
        (1, 'RM001', 'วัตถุดิบ A', 'Raw Material A', 'raw_material', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'PM001', 'บรรจุภัณฑ์ A', 'Packaging A', 'packaging', 'packaging', 'unit', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // Link items to vendors (AVL - Approved Vendor List)
    sqlite.exec(`
      INSERT INTO approved_vendor_list (id, item_id, vendor_id, is_preferred, approval_date, created_at)
      VALUES
        (1, 1, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 2, 1, 0, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedWarehouses() {
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH001', 'Main Warehouse', 'raw_material', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // warehouse_locations doesn't have updated_at
    sqlite.exec(`
      INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at)
      VALUES (1, 1, 'LOC001', 'Location 1', 1, '${getSqliteDate()}')
    `);
  }

  function seedPurchaseOrder() {
    seedItems();
    seedWarehouses();
    // purchase_orders: po_number, vendor_id, status, total_amount, currency, order_date, expected_date
    sqlite.exec(`
      INSERT INTO purchase_orders (id, po_number, vendor_id, order_date, expected_date, status, total_amount, currency, created_by, created_at, updated_at)
      VALUES (1, 'PO-202401-0001', 1, '2024-01-15', '2024-01-22', 'draft', 1000, 'THB', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // purchase_order_lines: po_id, item_id, quantity, unit, unit_price, total_price, expected_date
    sqlite.exec(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, unit, unit_price, total_price, expected_date, created_at)
      VALUES
        (1, 1, 1, 10, 'kg', 100, 1000, '2024-01-22', '${getSqliteDate()}')
    `);
  }

  describe('checkVendorApproval', () => {
    it('should query without schema errors', async () => {
      seedItems();

      const approval = await checkVendorApproval(1, 1);

      expect(approval).toBeDefined();
      expect(typeof approval.approved).toBe('boolean');
    });

    it('should return approved for approved vendor with item', async () => {
      seedItems();

      const approval = await checkVendorApproval(1, 1);

      expect(approval.approved).toBe(true);
    });

    it('should return not approved for non-approved vendor', async () => {
      seedItems();

      const approval = await checkVendorApproval(2, 1);

      expect(approval.approved).toBe(false);
    });

    it('should include reason when not approved', async () => {
      seedItems();

      const approval = await checkVendorApproval(2, 1);

      expect(approval).toHaveProperty('message');
    });
  });

  describe('getPreferredVendor', () => {
    it('should query without schema errors', async () => {
      seedItems();

      const vendorId = await getPreferredVendor(1);

      expect(vendorId === null || typeof vendorId === 'number').toBe(true);
    });

    it('should return preferred vendor ID', async () => {
      seedItems();

      const vendorId = await getPreferredVendor(1);

      expect(vendorId).toBe(1);
    });

    it('should return null for item without any AVL entry', async () => {
      seedItems();
      // Item 99 doesn't exist in AVL
      const vendorId = await getPreferredVendor(99);

      expect(vendorId).toBeNull();
    });
  });

  describe('createPurchaseOrder', () => {
    it('should insert without schema errors', async () => {
      seedItems();
      seedWarehouses();

      // createPurchaseOrder(vendorId, lines, userId): returns ID (number)
      const poId = await createPurchaseOrder(
        1,
        [{ itemId: 1, quantity: 20, unitPrice: 100, requiredDate: '2024-01-27' }],
        1
      );

      expect(poId).toBeDefined();
      expect(typeof poId).toBe('number');
      expect(poId).toBeGreaterThan(0);
    });

    it('should be retrievable after creation', async () => {
      seedItems();
      seedWarehouses();

      const poId = await createPurchaseOrder(
        1,
        [{ itemId: 1, quantity: 10, unitPrice: 100, requiredDate: '2024-01-27' }],
        1
      );

      const po = sqlite.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as { id: number; status: string };
      expect(po).toBeDefined();
      expect(po.id).toBe(poId);
      expect(po.status).toBe('draft');
    });

    it('should calculate totals correctly', async () => {
      seedItems();
      seedWarehouses();

      const poId = await createPurchaseOrder(
        1,
        [
          { itemId: 1, quantity: 10, unitPrice: 100, requiredDate: '2024-01-27' },
        ],
        1
      );

      const po = sqlite.prepare('SELECT total_amount FROM purchase_orders WHERE id = ?').get(poId) as { total_amount: number };
      expect(po.total_amount).toBe(1000); // 10*100
    });
  });

  describe('updatePurchaseOrderStatus', () => {
    it('should update without schema errors', async () => {
      seedPurchaseOrder();

      // Valid transition from 'draft' is to 'pending_approval' or 'cancelled'
      const result = await updatePurchaseOrderStatus(1, 'pending_approval', 1);

      expect(result).toBeDefined();
      expect(typeof result).toBe('boolean');
    });

    it('should update status field', async () => {
      seedPurchaseOrder();

      await updatePurchaseOrderStatus(1, 'pending_approval', 1);

      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = 1').get() as { status: string };
      expect(po.status).toBe('pending_approval');
    });
  });

  describe('Schema Validation', () => {
    it('should handle all purchase order columns correctly', async () => {
      seedItems();
      seedWarehouses();

      const poId = await createPurchaseOrder(
        1,
        [{ itemId: 1, quantity: 5, unitPrice: 100, requiredDate: '2024-02-08' }],
        1
      );

      const po = sqlite.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as Record<string, unknown>;

      expect(po).toHaveProperty('id');
      expect(po).toHaveProperty('po_number');
      expect(po).toHaveProperty('vendor_id');
      expect(po).toHaveProperty('status');
      expect(po).toHaveProperty('total_amount');
      expect(po).toHaveProperty('currency');
      expect(po).toHaveProperty('created_by');
      expect(po).toHaveProperty('created_at');
      expect(po).toHaveProperty('updated_at');
    });
  });
});
