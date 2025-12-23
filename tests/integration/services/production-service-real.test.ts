/**
 * Production Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7 - การดำเนินการผลิต)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete production module functionality with real-world scenarios.
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
  explodeBOM,
  createWorkOrder,
  updateWorkOrderStatus,
  dispenseMaterial,
  calculateYield,
  recordProductionOutput,
  performLineClearance,
  calculateBOMCost,
  getWhereUsed,
  detectCircularReference,
  copyBOM,
  addBOMLine,
  updateBOMLine,
  removeBOMLine,
  explodeBOMConsolidated,
} from '@/lib/services/production.service';

// Import inventory functions for seeding
import { receiveMaterial, updateLotStatus } from '@/lib/services/inventory.service';

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

describe('Production Service Real Integration Tests', () => {
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
      schema.sqliteBOMLines,
      schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials,
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
    sqlite.exec('DELETE FROM work_order_materials');
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM work_orders');
    sqlite.exec('DELETE FROM bom_lines');
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
        (1, 'production@test.com', 'hash', 'Production User', 'production', 1),
        (2, 'qa@test.com', 'hash', 'QA User', 'quality_assurance', 1)
    `);

    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active)
      VALUES (1, 'VEN-001', 'Herb Supplier', 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES
        (1, 'RM-001', 'ฟ้าทะลายโจร', 'Andrographis', 'raw_material', 'herb', 'kg', 365, 100, 5000, 1, 1, 1),
        (2, 'RM-002', 'ขมิ้นชัน', 'Turmeric', 'raw_material', 'herb', 'kg', 365, 50, 2500, 1, 1, 1),
        (3, 'PM-001', 'แคปซูลเปล่า', 'Empty Capsule', 'packaging', 'capsule', 'pcs', 730, 10000, 1000, 1, 0, 1),
        (4, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1),
        (5, 'WIP-001', 'สารสกัดฟ้าทะลายโจร', 'Andrographis Extract', 'extract', 'extract', 'kg', 180, 10, 2000, 1, 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-RM', 'Raw Material Warehouse', 'raw_material', 1),
        (2, 'WH-QA', 'Quarantine Area', 'quarantine', 1),
        (3, 'WH-FG', 'Finished Goods Warehouse', 'finished_goods', 1)
    `);

    // Create BOM for finished product
    sqlite.exec(`
      INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target, loss_allowance)
      VALUES (1, 'BOM-FG-001', 'Andrographis Capsule Recipe', 4, '1.0', 'approved', 1000, 'box', 95, 2)
    `);

    sqlite.exec(`
      INSERT INTO bom_lines (id, bom_id, item_id, quantity, unit, sequence, is_optional)
      VALUES
        (1, 1, 1, 50, 'kg', 1, 0),
        (2, 1, 2, 10, 'kg', 2, 0),
        (3, 1, 3, 1000, 'pcs', 3, 0)
    `);
  });

  // ============================================
  // SCENARIO 1: Work Order Execution Workflow
  // ============================================
  describe('Real-World Scenario: Work Order Execution', () => {
    it('should create work order from BOM', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      expect(workOrderId).toBeGreaterThan(0);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo).toBeDefined();
      expect(wo.status).toBe('planned');
      expect(wo.planned_quantity).toBe(500);
      expect(wo.batch_number).toBeDefined();
    });

    it('should release work order for production', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('released');
    });

    it('should transition work order from released to in_progress', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);

      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('in_progress');
      expect(wo.actual_start_date).toBeDefined();
    });

    it('should complete work order after production', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);

      await updateWorkOrderStatus(workOrderId, 'completed', TEST_USER_ID);

      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('completed');
      expect(wo.actual_end_date).toBeDefined();
    });

    it('should prevent invalid status transitions', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      // Cannot go directly from planned to in_progress
      await expect(
        updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID)
      ).rejects.toThrow(/Cannot transition/);
    });
  });

  // ============================================
  // SCENARIO 2: Material Dispensing with Verification
  // ============================================
  describe('Real-World Scenario: Material Dispensing', () => {
    let releasedLotId: number;
    let workOrderId: number;

    beforeEach(async () => {
      // Create and release raw material lot
      releasedLotId = await receiveMaterial(1, 'LOT-RM-001', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(releasedLotId, 'released', TEST_USER_ID, 'QC approved');

      // Create work order
      workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
    });

    it('should dispense material within tolerance', async () => {
      const result = await dispenseMaterial(workOrderId, releasedLotId, 25, TEST_USER_ID);

      expect(result.success).toBe(true);
      expect(result.deviationRequired).toBe(false);
    });

    it('should flag deviation when outside tolerance', async () => {
      // Required is ~25 kg (50kg * 500/1000), tolerance 2% means 24.5-25.5
      // Dispense 30 kg - way outside tolerance
      const result = await dispenseMaterial(workOrderId, releasedLotId, 30, TEST_USER_ID, 2);

      expect(result.success).toBe(true);
      expect(result.deviationRequired).toBe(true);
      expect(result.message).toContain('Deviation required');
    });

    it('should prevent dispensing from unreleased lot', async () => {
      const quarantineLotId = await receiveMaterial(2, 'LOT-Q-001', 50, 'kg', 2, FUTURE_DATE, 1, null, TEST_USER_ID);

      await expect(
        dispenseMaterial(workOrderId, quarantineLotId, 5, TEST_USER_ID)
      ).rejects.toThrow(/not released/);
    });

    it('should prevent dispensing non-BOM items', async () => {
      // Create lot for item not in BOM
      const nonBomLotId = await receiveMaterial(5, 'LOT-NB-001', 10, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(nonBomLotId, 'released', TEST_USER_ID);

      await expect(
        dispenseMaterial(workOrderId, nonBomLotId, 5, TEST_USER_ID)
      ).rejects.toThrow(/not in the BOM/);
    });
  });

  // ============================================
  // SCENARIO 3: Line Clearance and Dual Verification
  // ============================================
  describe('Real-World Scenario: Line Clearance', () => {
    it('should pass line clearance when all items checked', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      const checklist = [
        { item: 'Previous batch materials removed', checked: true },
        { item: 'Equipment cleaned and verified', checked: true },
        { item: 'Correct labels applied', checked: true },
        { item: 'SOP reviewed', checked: true },
      ];

      const result = await performLineClearance(workOrderId, checklist, TEST_USER_ID);
      expect(result).toBe(true);
    });

    it('should fail line clearance with unchecked items', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      const checklist = [
        { item: 'Previous batch materials removed', checked: true },
        { item: 'Equipment cleaned and verified', checked: false },
        { item: 'Correct labels applied', checked: true },
      ];

      await expect(
        performLineClearance(workOrderId, checklist, TEST_USER_ID)
      ).rejects.toThrow(/Line clearance incomplete/);
    });
  });

  // ============================================
  // CRUD Functions Tests
  // ============================================
  describe('Production Service CRUD Functions', () => {
    it('should create work order with auto-generated number', async () => {
      const id1 = await createWorkOrder(1, 100, TODAY, TEST_USER_ID);
      const id2 = await createWorkOrder(1, 200, TODAY, TEST_USER_ID);

      const wo1 = sqlite.prepare('SELECT wo_number FROM work_orders WHERE id = ?').get(id1) as any;
      const wo2 = sqlite.prepare('SELECT wo_number FROM work_orders WHERE id = ?').get(id2) as any;

      expect(wo1.wo_number).toMatch(/^WO-\d{6}-\d{4}$/);
      expect(wo2.wo_number).toMatch(/^WO-\d{6}-\d{4}$/);
      expect(wo1.wo_number).not.toBe(wo2.wo_number);
    });

    it('should update work order status with proper workflow', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      // Follow proper workflow
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'completed', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'closed', TEST_USER_ID);

      const wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('closed');
    });
  });

  // ============================================
  // Batch Record Functions Tests
  // ============================================
  describe('Batch Record Functions', () => {
    it('should record production output and create output lot', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);

      const outputLotId = await recordProductionOutput(workOrderId, 480, 10, 3, TEST_USER_ID);

      expect(outputLotId).toBeGreaterThan(0);

      // Verify output lot created
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(outputLotId) as any;
      expect(lot).toBeDefined();
      expect(lot.quantity).toBe(480);
      expect(lot.warehouse_id).toBe(3); // FG warehouse
      expect(lot.status).toBe('quarantine'); // Starts in quarantine

      // Verify work order updated
      const wo = sqlite.prepare('SELECT * FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.actual_quantity).toBe(480);
    });

    it('should calculate yield correctly', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);
      await recordProductionOutput(workOrderId, 480, 10, 3, TEST_USER_ID);

      const yield_ = await calculateYield(workOrderId);

      expect(yield_.theoretical).toBe(500);
      expect(yield_.actualGood).toBe(480);
      expect(yield_.yieldPercent).toBe(96);
      expect(yield_.status).toBe('normal');
    });

    it('should flag low yield when below target', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);
      await recordProductionOutput(workOrderId, 400, 50, 3, TEST_USER_ID);

      const yield_ = await calculateYield(workOrderId);

      expect(yield_.yieldPercent).toBe(80);
      expect(yield_.status).toBe('low_yield');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    it('should handle yield variance deviation', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);

      // Very low yield
      await recordProductionOutput(workOrderId, 350, 100, 3, TEST_USER_ID);

      const yield_ = await calculateYield(workOrderId);
      expect(yield_.status).toBe('low_yield');
      expect(yield_.yieldPercent).toBe(70);
    });

    it('should handle work order cancellation', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);

      await updateWorkOrderStatus(workOrderId, 'cancelled', TEST_USER_ID, 'Material shortage');

      const wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('cancelled');

      // Cannot resume cancelled work order
      await expect(
        updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID)
      ).rejects.toThrow();
    });

    it('should handle on_hold and resume', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID);

      // Put on hold
      await updateWorkOrderStatus(workOrderId, 'on_hold', TEST_USER_ID, 'Equipment breakdown');

      let wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('on_hold');

      // Resume
      await updateWorkOrderStatus(workOrderId, 'in_progress', TEST_USER_ID, 'Equipment fixed');

      wo = sqlite.prepare('SELECT status FROM work_orders WHERE id = ?').get(workOrderId) as any;
      expect(wo.status).toBe('in_progress');
    });
  });

  // ============================================
  // BOM Management Functions
  // ============================================
  describe('BOM Management Functions', () => {
    it('should explode BOM with correct quantities', async () => {
      const explosion = await explodeBOM(1, 500);

      expect(explosion.length).toBe(3);

      // Check scaled quantities (500 boxes = 50% of 1000 batch)
      const rm1 = explosion.find(e => e.itemCode === 'RM-001');
      expect(rm1).toBeDefined();
      expect(rm1!.requiredQuantity).toBeGreaterThan(24); // ~25 kg with loss allowance
    });

    it('should calculate BOM cost', async () => {
      const costResult = await calculateBOMCost(1);

      expect(costResult.bomCode).toBe('BOM-FG-001');
      expect(costResult.batchSize).toBe(1000);
      expect(costResult.breakdown.length).toBe(3);
      expect(costResult.totalMaterialCost).toBeGreaterThan(0);
      expect(costResult.costPerUnit).toBeGreaterThan(0);
    });

    it('should find where-used for materials', async () => {
      const whereUsed = await getWhereUsed(1); // Andrographis

      expect(whereUsed.length).toBe(1);
      expect(whereUsed[0].bomCode).toBe('BOM-FG-001');
      expect(whereUsed[0].productCode).toBe('FG-001');
    });

    it('should copy BOM with new code', async () => {
      const newBomId = await copyBOM(1, {
        newCode: 'BOM-FG-002',
        newVersion: '2.0',
        newName: 'Andrographis Capsule Recipe v2',
      }, TEST_USER_ID);

      expect(newBomId).toBeGreaterThan(0);

      const newBom = sqlite.prepare('SELECT * FROM bom WHERE id = ?').get(newBomId) as any;
      expect(newBom.code).toBe('BOM-FG-002');
      expect(newBom.version).toBe('2.0');

      // Check lines were copied
      const lines = sqlite.prepare('SELECT COUNT(*) as count FROM bom_lines WHERE bom_id = ?').get(newBomId) as any;
      expect(lines.count).toBe(3);
    });

    it('should add line to BOM', async () => {
      // Create a new BOM for testing
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (10, 'BOM-TEST', 'Test BOM', 4, '1.0', 'draft', 100, 'box')
      `);

      const lineId = await addBOMLine(10, {
        itemId: 1,
        quantity: 10,
        unit: 'kg',
      }, TEST_USER_ID);

      expect(lineId).toBeGreaterThan(0);

      const line = sqlite.prepare('SELECT * FROM bom_lines WHERE id = ?').get(lineId) as any;
      expect(line.quantity).toBe(10);
    });

    it('should update BOM line quantity', async () => {
      await updateBOMLine(1, { quantity: 60 }, TEST_USER_ID);

      const line = sqlite.prepare('SELECT quantity FROM bom_lines WHERE id = 1').get() as any;
      expect(line.quantity).toBe(60);
    });

    it('should remove BOM line', async () => {
      // Add a line first
      sqlite.exec(`
        INSERT INTO bom_lines (id, bom_id, item_id, quantity, unit, sequence)
        VALUES (100, 1, 5, 5, 'kg', 4)
      `);

      await removeBOMLine(100, TEST_USER_ID);

      const line = sqlite.prepare('SELECT * FROM bom_lines WHERE id = 100').get();
      expect(line).toBeUndefined();
    });

    it('should detect circular reference in BOM', async () => {
      // Create a circular reference scenario:
      // Product A uses WIP B, WIP B has BOM that uses Product A

      // Create WIP B's BOM that uses Product A (FG-001)
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (20, 'BOM-WIP-001', 'WIP BOM', 5, '1.0', 'approved', 10, 'kg')
      `);
      sqlite.exec(`
        INSERT INTO bom_lines (bom_id, item_id, quantity, unit, sequence)
        VALUES (20, 4, 1, 'box', 1)
      `);

      // Now BOM 1 uses item 5 (WIP-001), and WIP-001's BOM uses item 4 (FG-001)
      // which is the product of BOM 1 - this is circular!

      // Add WIP to the main BOM to complete the circle
      sqlite.exec(`
        INSERT INTO bom_lines (bom_id, item_id, quantity, unit, sequence)
        VALUES (1, 5, 5, 'kg', 4)
      `);

      const circularPath = await detectCircularReference(1);
      expect(circularPath).not.toBeNull();
    });

    it('should consolidate BOM explosion by item', async () => {
      const consolidated = await explodeBOMConsolidated(1, 500);

      expect(consolidated.items.length).toBe(3);
      expect(consolidated.totalCost).toBeGreaterThan(0);
      expect(consolidated.summary.totalItems).toBe(3);
    });
  });

  // ============================================
  // Material Dispensing Edge Cases
  // ============================================
  describe('Material Dispensing Edge Cases', () => {
    it('should reject dispensing when work order not released', async () => {
      const lotId = await receiveMaterial(1, 'LOT-TEST', 100, 'kg', 1, FUTURE_DATE, 1, null, TEST_USER_ID);
      await updateLotStatus(lotId, 'released', TEST_USER_ID);

      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      // Work order is still 'planned', not released

      await expect(
        dispenseMaterial(workOrderId, lotId, 25, TEST_USER_ID)
      ).rejects.toThrow(/Released or In Progress/);
    });
  });

  // ============================================
  // Production Output Edge Cases
  // ============================================
  describe('Production Output Edge Cases', () => {
    it('should reject output when work order not in_progress', async () => {
      const workOrderId = await createWorkOrder(1, 500, TODAY, TEST_USER_ID);
      await updateWorkOrderStatus(workOrderId, 'released', TEST_USER_ID);
      // Not yet in_progress

      await expect(
        recordProductionOutput(workOrderId, 480, 10, 3, TEST_USER_ID)
      ).rejects.toThrow(/In Progress/);
    });
  });
});
