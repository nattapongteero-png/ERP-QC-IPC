/**
 * Production Service Integration Tests
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

// Mock dependent services that make external calls
vi.mock('@/lib/services/line-clearance.service', () => ({
  canStartProduction: vi.fn().mockResolvedValue({ allowed: true, errors: [] }),
}));

vi.mock('@/lib/services/variance-analysis.service', () => ({
  calculateWorkOrderVariances: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  getItemWAC: vi.fn().mockResolvedValue(100),
  updateFinishedGoodsWAC: vi.fn().mockResolvedValue(undefined),
}));

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
import { getSqliteDate, getSqliteDateOffset } from '../../../helpers/service-test-utils';

// Now import the service (after mock is set up)
import {
  explodeBOM,
  createWorkOrder,
  updateWorkOrderStatus,
  calculateYield,
  calculateBOMCost,
  getWhereUsed,
} from '@/lib/services/production.service';

describe('Production Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteVendors,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteItems,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqliteBOM,
      schema.sqliteBOMLines,
      schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials,
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
      'work_order_materials',
      'work_orders',
      'bom_lines',
      'bom',
      'inventory_transactions',
      'inventory_lots',
      'warehouse_locations',
      'warehouses',
      'vendors',
      'items',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helper for production data
  function seedProductionData() {
    // Seed vendor
    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (1, 'V001', 'Test Vendor', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed warehouse
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH001', 'Main Warehouse', 'raw_material', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed items
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
      VALUES
        (1, 'FG001', 'ผลิตภัณฑ์สำเร็จรูป', 'Finished Product', 'finished', 'product', 'unit', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'RM001', 'วัตถุดิบ 1', 'Raw Material 1', 'raw', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 'RM002', 'วัตถุดิบ 2', 'Raw Material 2', 'raw', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (4, 'RM003', 'วัตถุดิบ 3', 'Raw Material 3', 'raw', 'packaging', 'pcs', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed inventory lots for raw materials
    sqlite.exec(`
      INSERT INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, created_at, updated_at)
      VALUES
        (1, 2, 'LOT-RM001-001', 1, 100, 0, 'kg', 'released', '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 3, 'LOT-RM002-001', 1, 50, 0, 'kg', 'released', '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 4, 'LOT-RM003-001', 1, 1000, 0, 'pcs', 'released', '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed BOM
    sqlite.exec(`
      INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, created_at, updated_at)
      VALUES (1, 'BOM-FG001', 'Finished Product BOM', 1, '1.0', 'approved', 100, 'unit', 98, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed BOM Lines
    sqlite.exec(`
      INSERT INTO bom_lines (id, bom_id, item_id, quantity, unit, sequence, is_optional, created_at)
      VALUES
        (1, 1, 2, 10, 'kg', 1, 0, '${getSqliteDate()}'),
        (2, 1, 3, 5, 'kg', 2, 0, '${getSqliteDate()}'),
        (3, 1, 4, 100, 'pcs', 3, 0, '${getSqliteDate()}')
    `);
  }

  function seedWorkOrder() {
    seedProductionData();

    // Seed work order
    sqlite.exec(`
      INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_by, created_at, updated_at)
      VALUES (1, 'WO-2024-0001', 1, 1, 'BATCH-001', 100, 'unit', 'planned', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedCompletedWorkOrder() {
    seedProductionData();

    // Seed completed work order with actual quantities
    sqlite.exec(`
      INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, yield_percentage, created_by, created_at, updated_at)
      VALUES (1, 'WO-2024-0001', 1, 1, 'BATCH-001', 100, 95, 'unit', 'completed', 95, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);

    // Seed work order materials
    sqlite.exec(`
      INSERT INTO work_order_materials (id, work_order_id, item_id, lot_id, planned_quantity, actual_quantity, unit, status, issued_by, issued_at)
      VALUES
        (1, 1, 2, 1, 10, 10.5, 'kg', 'issued', 1, '${getSqliteDate()}'),
        (2, 1, 3, 2, 5, 5.2, 'kg', 'issued', 1, '${getSqliteDate()}'),
        (3, 1, 4, 3, 100, 98, 'pcs', 'issued', 1, '${getSqliteDate()}')
    `);
  }

  describe('explodeBOM', () => {
    it('should query without schema errors', async () => {
      seedProductionData();

      const result = await explodeBOM(1, 100);

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
    });

    it('should return all BOM line materials', async () => {
      seedProductionData();

      const result = await explodeBOM(1, 100);

      expect(result.length).toBe(3);
      expect(result[0]).toHaveProperty('itemId');
      expect(result[0]).toHaveProperty('itemCode');
      expect(result[0]).toHaveProperty('requiredQuantity');
      expect(result[0]).toHaveProperty('availableStock');
    });

    it('should calculate required quantities correctly', async () => {
      seedProductionData();

      const result = await explodeBOM(1, 100);

      // BOM batch size is 100, so ratio is 1:1
      const rm1 = result.find(r => r.itemCode === 'RM001');
      expect(rm1?.requiredQuantity).toBe(10); // 10kg per 100 units
    });

    it('should calculate available stock', async () => {
      seedProductionData();

      const result = await explodeBOM(1, 100);

      const rm1 = result.find(r => r.itemCode === 'RM001');
      expect(rm1?.availableStock).toBe(100); // 100kg in released lot
    });

    it('should calculate shortage correctly', async () => {
      seedProductionData();

      // Request 200 units (double batch), requiring 20kg of RM001
      const result = await explodeBOM(1, 200);

      const rm1 = result.find(r => r.itemCode === 'RM001');
      expect(rm1?.requiredQuantity).toBe(20);
      expect(rm1?.shortage).toBe(0); // 100kg available, 20kg required
    });

    it('should throw error for non-existent BOM', async () => {
      await expect(explodeBOM(99999, 100)).rejects.toThrow();
    });
  });

  describe('createWorkOrder', () => {
    it('should insert without schema errors', async () => {
      seedProductionData();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      expect(woId).toBeDefined();
      expect(woId).toBeGreaterThan(0);
    });

    it('should generate work order number', async () => {
      seedProductionData();

      const woId = await createWorkOrder(1, 50, getSqliteDateOffset(1), 1);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as { wo_number: string };
      // Format is WO-YYYYMM-NNNN (e.g., WO-202601-0001)
      expect(wo.wo_number).toMatch(/^WO-\d{6}-\d{4}$/);
    });

    it('should set initial status to planned', async () => {
      seedProductionData();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as { status: string };
      expect(wo.status).toBe('planned');
    });

    it('should link to BOM and product', async () => {
      seedProductionData();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as { bom_id: number; product_id: number };
      expect(wo.bom_id).toBe(1);
      expect(wo.product_id).toBe(1);
    });
  });

  describe('updateWorkOrderStatus', () => {
    it('should update status without schema errors', async () => {
      seedWorkOrder();

      const result = await updateWorkOrderStatus(1, 'released', 1);

      expect(result).toBe(true);
    });

    it('should follow workflow transitions', async () => {
      seedWorkOrder();

      // planned -> released
      await updateWorkOrderStatus(1, 'released', 1);

      const wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = 1').get() as { status: string };
      expect(wo.status).toBe('released');
    });

    it('should reject invalid transitions', async () => {
      seedWorkOrder();

      // planned -> completed (should fail, needs to go through released and in_progress)
      await expect(updateWorkOrderStatus(1, 'completed', 1)).rejects.toThrow();
    });
  });

  describe('calculateYield', () => {
    it('should calculate without schema errors', async () => {
      seedCompletedWorkOrder();

      const result = await calculateYield(1);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('theoretical');
      expect(result).toHaveProperty('actualGood');
      expect(result).toHaveProperty('yieldPercent');
    });

    it('should calculate yield percentage correctly', async () => {
      seedCompletedWorkOrder();

      const result = await calculateYield(1);

      // Planned 100, actual 95 = 95% yield
      expect(result.yieldPercent).toBeCloseTo(95, 1);
    });

    it('should determine yield status', async () => {
      seedCompletedWorkOrder();

      const result = await calculateYield(1);

      // 95% yield with 98% target = normal (low_yield only when yield < target - 5%)
      // 95 >= (98 - 5) = 93, so status is 'normal'
      expect(result.status).toBe('normal');
    });
  });

  describe('calculateBOMCost', () => {
    it('should calculate without schema errors', async () => {
      seedProductionData();

      const result = await calculateBOMCost(1);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('bomId');
      expect(result).toHaveProperty('breakdown');
      expect(result).toHaveProperty('totalMaterialCost');
    });

    it('should include all BOM lines', async () => {
      seedProductionData();

      const result = await calculateBOMCost(1);

      expect(result.breakdown.length).toBe(3);
    });

    it('should calculate line costs', async () => {
      seedProductionData();

      const result = await calculateBOMCost(1);

      // Each line should have cost calculation
      result.breakdown.forEach((line: { quantity: number; unitCost: number; totalCost: number }) => {
        expect(line).toHaveProperty('quantity');
        expect(line).toHaveProperty('unitCost');
        expect(line).toHaveProperty('totalCost');
      });
    });
  });

  describe('getWhereUsed', () => {
    it('should query without schema errors', async () => {
      seedProductionData();

      const result = await getWhereUsed(2); // Raw material 1

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
    });

    it('should find BOMs using the item', async () => {
      seedProductionData();

      const result = await getWhereUsed(2); // Raw material 1

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty('bomId');
      expect(result[0]).toHaveProperty('bomCode');
    });

    it('should return empty for unused items', async () => {
      seedProductionData();

      // Add an unused item
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, created_at, updated_at)
        VALUES (99, 'UNUSED', 'ไม่ได้ใช้', 'Unused Item', 'raw', 'herb', 'kg', 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);

      const result = await getWhereUsed(99);

      expect(result).toEqual([]);
    });
  });

  describe('Schema Validation', () => {
    it('should handle all work order columns correctly', async () => {
      seedProductionData();

      const woId = await createWorkOrder(1, 100, getSqliteDateOffset(1), 1);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(woId) as Record<string, unknown>;

      expect(wo).toHaveProperty('id');
      expect(wo).toHaveProperty('wo_number');
      expect(wo).toHaveProperty('bom_id');
      expect(wo).toHaveProperty('product_id');
      expect(wo).toHaveProperty('batch_number');
      expect(wo).toHaveProperty('planned_quantity');
      expect(wo).toHaveProperty('status');
      expect(wo).toHaveProperty('created_at');
      expect(wo).toHaveProperty('updated_at');
    });

    it('should handle BOM columns correctly', async () => {
      seedProductionData();

      const bom = sqlite.prepare('SELECT * FROM bom WHERE id = 1').get() as Record<string, unknown>;

      expect(bom).toHaveProperty('id');
      expect(bom).toHaveProperty('code');
      expect(bom).toHaveProperty('name');
      expect(bom).toHaveProperty('product_id');
      expect(bom).toHaveProperty('version');
      expect(bom).toHaveProperty('status');
      expect(bom).toHaveProperty('batch_size');
      expect(bom).toHaveProperty('batch_unit');
    });

    it('should handle BOM lines columns correctly', async () => {
      seedProductionData();

      const line = sqlite.prepare('SELECT * FROM bom_lines WHERE id = 1').get() as Record<string, unknown>;

      expect(line).toHaveProperty('id');
      expect(line).toHaveProperty('bom_id');
      expect(line).toHaveProperty('item_id');
      expect(line).toHaveProperty('quantity');
      expect(line).toHaveProperty('unit');
      expect(line).toHaveProperty('sequence');
    });
  });
});
