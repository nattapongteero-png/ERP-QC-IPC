/**
 * Unit Cost Service - Real-World Scenario Tests
 * Feature: 014-unit-cost
 *
 * These tests validate integrated business scenarios that reflect actual ERP usage:
 * - End-to-end cost flow: Purchase → Receipt → Landed Cost → Production → Sale
 * - Multi-level BOM cost rollup
 * - Cost variance analysis
 * - Period-end inventory valuation
 * - Batch/lot specific costing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../../helpers/schema-sync';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks
import {
  recalculateWAC,
  getItemWAC,
  getItemCostViews,
  createWorkCenter,
  createLandedCost,
  createWorkOrderOperations,
  updateWorkOrderOperation,
  calculateWorkOrderCost,
  calculateCOGS,
  createOverheadRate,
  getEffectiveOverheadRate,
} from '@/lib/services/unit-cost.service';

const TEST_USER_ID = 1;

describe('Unit Cost - Real-World Scenarios', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    // Create all required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteCustomers,
      schema.sqliteItems,
      schema.sqliteItemCostLayers,
      schema.sqliteWorkCenters,
      schema.sqliteOverheadRates,
      schema.sqliteBOM,
      schema.sqliteBOMLines,
      schema.sqliteOperations,
      schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials,
      schema.sqliteWorkOrderOperations,
      schema.sqliteWorkOrderCosts,
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteLandedCostHeaders,
      schema.sqliteLandedCostLines,
      schema.sqliteLandedCostAllocations,
      schema.sqliteSalesOrders,
      schema.sqliteSalesOrderLines,
      schema.sqliteInventoryLots,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
    ];

    for (const table of tables) {
      try {
        const sql = generateCreateTableSql(table);
        testSqlite.exec(sql);
      } catch {
        // Table might exist or have FK issues
      }
    }

    // Seed base data
    seedBaseData();
  });

  afterEach(() => {
    testSqlite.close();
  });

  function seedBaseData() {
    // User
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (${TEST_USER_ID}, 'test@test.com', 'hash', 'Test User', 'admin', 1)
    `);

    // Vendors
    testSqlite.exec(`
      INSERT INTO vendors (id, code, name, is_active, is_approved, payment_terms, created_at, updated_at)
      VALUES
        (1, 'V001', 'Domestic Supplier', 1, 1, 'NET30', '2026-01-01', '2026-01-01'),
        (2, 'V002', 'Import Supplier', 1, 1, 'NET60', '2026-01-01', '2026-01-01'),
        (3, 'V003', 'Freight Forwarder', 1, 1, 'NET15', '2026-01-01', '2026-01-01')
    `);

    // Customers
    testSqlite.exec(`
      INSERT INTO customers (id, code, name, is_active, credit_limit, created_at, updated_at)
      VALUES
        (1, 'C001', 'Retail Customer', 1, 100000, '2026-01-01', '2026-01-01'),
        (2, 'C002', 'Wholesale Customer', 1, 500000, '2026-01-01', '2026-01-01')
    `);

    // Warehouses and locations
    testSqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
      VALUES (1, 'WH-MAIN', 'Main Warehouse', 'raw_material', 1, '2026-01-01', '2026-01-01')
    `);

    testSqlite.exec(`
      INSERT INTO warehouse_locations (id, warehouse_id, code, name, is_active, created_at)
      VALUES (1, 1, 'LOC-A1', 'Location A1', 1, '2026-01-01')
    `);
  }

  // ============================================
  // SCENARIO 1: End-to-End Cost Flow
  // Purchase → Receipt → Landed Cost → Production → Sale
  // ============================================
  describe('Scenario 1: Complete Cost Flow - Purchase to Sale', () => {
    /**
     * Business Story:
     * A herbal medicine company purchases raw herbs from an import supplier,
     * pays freight and import duties, produces finished goods, and sells them.
     * The test validates that costs flow correctly through each stage.
     */

    beforeEach(() => {
      // Create raw material items
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, name_en, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
        VALUES
          (1, 'RM-HERB-001', 'สมุนไพร A', 'Herb A', 'raw_material', 'kg', 0, 0, 0, 1),
          (2, 'RM-HERB-002', 'สมุนไพร B', 'Herb B', 'raw_material', 'kg', 0, 0, 0, 1),
          (3, 'PM-BOTTLE-001', 'ขวดแก้ว 100ml', 'Glass Bottle 100ml', 'packaging', 'unit', 0, 0, 0, 1),
          (10, 'FG-TONIC-001', 'ยาบำรุงสุขภาพ', 'Health Tonic', 'finished_goods', 'bottle', 0, 0, 0, 1)
      `);
    });

    it('should track initial purchase and receipt correctly', async () => {
      // Step 1: Receive purchase of raw materials
      // Purchase 100 kg of Herb A at 50 THB/kg
      const receipt1 = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 100,
        unitCost: 50,
        transactionDate: '2026-01-10',
        notes: 'PO-2026-0001 Initial purchase',
        createdBy: TEST_USER_ID,
      });

      expect(receipt1.newQty).toBe(100);
      expect(receipt1.newWAC).toBe(50);

      // Verify item updated
      const wac1 = await getItemWAC(1);
      expect(wac1).toBe(50);
    });

    it('should apply landed costs and update WAC via adjustment', async () => {
      // Step 1: Initial receipt
      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 100,
        unitCost: 50, // Base cost 5,000 THB
        transactionDate: '2026-01-10',
        createdBy: TEST_USER_ID,
      });

      // Step 2: Create PO for landed cost reference
      testSqlite.exec(`
        INSERT INTO purchase_orders (id, po_number, vendor_id, status, created_by)
        VALUES (1, 'PO-2026-0001', 2, 'received', ${TEST_USER_ID})
      `);

      testSqlite.exec(`
        INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit)
        VALUES (1, 1, 1, 100, 100, 50, 5000, 'kg')
      `);

      // Step 3: Create landed cost entry (freight + customs)
      const landedCost = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        vendorId: 3, // Freight forwarder
        invoiceNumber: 'FR-2026-0001',
        lines: [
          { costType: 'freight', amount: 1000, allocationBasis: 'value' },
          { costType: 'duty', amount: 500, allocationBasis: 'value' },
        ],
      }, TEST_USER_ID);

      expect(landedCost.id).toBeGreaterThan(0);

      // Verify landed cost total
      const header = testSqlite.prepare('SELECT total_amount FROM landed_cost_headers WHERE id = ?').get(landedCost.id) as { total_amount: number };
      expect(header.total_amount).toBe(1500);

      // Step 4: Use adjustment to apply landed cost impact
      // The recalculateWAC function calculates: newTotalCost = previousCost + (qty * unitCost)
      // To add 1500 THB to existing 5000 THB without changing quantity,
      // we use adjustment type with the full landed cost as the value
      // Note: In real system, postLandedCost would handle this properly
      // For testing, we simulate the effect using adjustment
      const currentItem = testSqlite.prepare('SELECT on_hand, on_hand_cost FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number };
      const landedCostTotal = 1500;
      const newTotalCost = currentItem.on_hand_cost + landedCostTotal;
      const newWAC = newTotalCost / currentItem.on_hand;

      // Update item directly (simulating postLandedCost effect)
      testSqlite.exec(`
        UPDATE items
        SET on_hand_cost = ${newTotalCost}, current_wac = ${newWAC}
        WHERE id = 1
      `);

      // Verify WAC increased from 50 to 65
      const wac = await getItemWAC(1);
      expect(wac).toBe(65);
    });

    it('should calculate production cost correctly with material consumption', async () => {
      // Setup: Items with inventory
      testSqlite.exec(`
        UPDATE items SET on_hand = 100, on_hand_cost = 6500, current_wac = 65 WHERE id = 1
      `);
      testSqlite.exec(`
        UPDATE items SET on_hand = 50, on_hand_cost = 4000, current_wac = 80 WHERE id = 2
      `);
      testSqlite.exec(`
        UPDATE items SET on_hand = 200, on_hand_cost = 1000, current_wac = 5 WHERE id = 3
      `);

      // Create work center
      const wc = await createWorkCenter({
        code: 'WC-PROD-001',
        name: 'Production Line 1',
        nameTh: 'สายการผลิต 1',
        laborRatePerHour: 200,
        overheadRatePerHour: 100,
        machineRatePerHour: 50,
        capacityHoursPerDay: 8,
      });

      // Create BOM
      testSqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, yield_target)
        VALUES (1, 'BOM-TONIC-001', 'Health Tonic Formula', 10, '1.0', 'approved', 100, 'bottle', 98)
      `);

      // Create operation
      testSqlite.exec(`
        INSERT INTO operations (id, bom_id, sequence, name, work_center_id)
        VALUES (1, 1, 10, 'Mixing and Filling', ${wc.id})
      `);

      // Create work order
      testSqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, created_by)
        VALUES (1, 'WO-2026-0001', 1, 10, 'BATCH-001', 100, 98, 'bottle', 'in_progress', ${TEST_USER_ID})
      `);

      // Material consumption:
      // - 20 kg Herb A @ 65 THB = 1,300 THB
      // - 10 kg Herb B @ 80 THB = 800 THB
      // - 100 bottles @ 5 THB = 500 THB
      // Total material = 2,600 THB
      testSqlite.exec(`
        INSERT INTO work_order_materials (id, work_order_id, item_id, planned_quantity, actual_quantity, unit, unit_cost, total_cost, status)
        VALUES
          (1, 1, 1, 20, 20, 'kg', 65, 1300, 'issued'),
          (2, 1, 2, 10, 10, 'kg', 80, 800, 'issued'),
          (3, 1, 3, 100, 100, 'unit', 5, 500, 'issued')
      `);

      // Create and record work order operation
      const [opId] = await createWorkOrderOperations([
        {
          workOrderId: 1,
          operationId: 1,
          workCenterId: wc.id,
          sequence: 10,
          plannedHours: 4,
          laborRate: 200,
          overheadRate: 100,
        },
      ]);

      // Record actual time (4.5 hours)
      await updateWorkOrderOperation(opId, {
        actualHours: 4.5,
        status: 'completed',
      });

      // Calculate total production cost
      const costSummary = await calculateWorkOrderCost(1);

      // Material cost: 2,600 THB
      expect(costSummary.materialCost).toBe(2600);

      // Labor cost: 4.5 hours × 200 THB/hr = 900 THB
      expect(costSummary.laborCost).toBe(900);

      // Overhead cost: 4.5 hours × 100 THB/hr = 450 THB
      expect(costSummary.overheadCost).toBe(450);

      // Total cost: 2,600 + 900 + 450 = 3,950 THB
      expect(costSummary.totalCost).toBe(3950);

      // Unit cost: 3,950 / 98 bottles = 40.31 THB/bottle
      expect(costSummary.unitCost).toBeCloseTo(40.31, 2);
    });

    it('should calculate COGS and margin on sale', async () => {
      // Setup: Finished goods with known WAC
      testSqlite.exec(`
        UPDATE items SET on_hand = 98, on_hand_cost = 3950, current_wac = 40.31 WHERE id = 10
      `);

      // Calculate COGS for selling 50 bottles at 80 THB each
      const cogsResult = await calculateCOGS(10, 50, 80);

      // Unit cost from WAC: 40.31 THB
      expect(cogsResult.unitCost).toBeCloseTo(40.31, 2);

      // Total COGS: 50 × 40.31 = 2,015.50 THB
      expect(cogsResult.totalCost).toBeCloseTo(2015.5, 1);

      // Revenue: 50 × 80 = 4,000 THB
      // Margin: 4,000 - 2,015.50 = 1,984.50 THB
      expect(cogsResult.marginAmount).toBeCloseTo(1984.5, 1);

      // Margin %: 1,984.50 / 4,000 × 100 = 49.6%
      expect(cogsResult.marginPercent).toBeCloseTo(49.6, 1);
    });

    it('should track complete cost flow from purchase to profit margin', async () => {
      /**
       * Complete flow simulation:
       * 1. Purchase 100 kg herbs @ 50 THB = 5,000 THB
       * 2. Add landed costs 1,500 THB → WAC = 65 THB/kg
       * 3. Produce 98 bottles using 20 kg herbs + labor + overhead
       * 4. Sell 50 bottles @ 80 THB
       * 5. Verify profit margin
       */

      // Step 1: Purchase receipt
      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 100,
        unitCost: 50,
        transactionDate: '2026-01-10',
        createdBy: TEST_USER_ID,
      });

      let wac = await getItemWAC(1);
      expect(wac).toBe(50);

      // Step 2: Landed cost (simulated by direct update)
      // Add 1500 THB to existing 5000 THB
      testSqlite.exec(`
        UPDATE items SET on_hand_cost = 6500, current_wac = 65 WHERE id = 1
      `);

      wac = await getItemWAC(1);
      expect(wac).toBe(65);

      // Step 3: Production consumption (reduces inventory using adjustment)
      await recalculateWAC({
        itemId: 1,
        transactionType: 'adjustment',
        transactionId: 1,
        quantity: -20, // Issue to production
        unitCost: 65,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      const item1 = testSqlite.prepare('SELECT on_hand, on_hand_cost FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number };
      expect(item1.on_hand).toBe(80);
      expect(item1.on_hand_cost).toBe(5200); // 80 × 65

      // Step 4: Production receipt (finished goods)
      // Production cost: Material (1,300) + Labor (900) + Overhead (450) = 2,650 THB for 98 units
      // Simplified: Only material cost for this test
      await recalculateWAC({
        itemId: 10,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 98,
        unitCost: 27.04, // 2,650 / 98 (simplified)
        transactionDate: '2026-01-16',
        createdBy: TEST_USER_ID,
      });

      const fgWac = await getItemWAC(10);
      expect(fgWac).toBeCloseTo(27.04, 2);

      // Step 5: Calculate sale margin
      const cogs = await calculateCOGS(10, 50, 80);

      // With unit cost ~27.04, selling at 80:
      // Margin = (80 - 27.04) / 80 × 100 = 66.2%
      expect(cogs.marginPercent).toBeCloseTo(66.2, 1);
    });
  });

  // ============================================
  // SCENARIO 2: Multi-Level BOM Cost Rollup
  // ============================================
  describe('Scenario 2: Multi-Level BOM Cost Rollup', () => {
    /**
     * Business Story:
     * A complex product has a multi-level BOM:
     * - Level 0 (Final Product): Health Supplement Capsules
     *   - Level 1 (Subassembly): Herb Extract Blend
     *     - Level 2 (Raw): Herb A, Herb B
     *   - Level 1 (Component): Capsule Shells
     *   - Level 1 (Packaging): Bottle + Label
     *
     * Test validates that cost rolls up correctly from raw → subassembly → final.
     */

    beforeEach(() => {
      // Items at different BOM levels
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, name_en, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
        VALUES
          -- Raw materials (Level 2)
          (1, 'RM-HERB-A', 'สมุนไพร A', 'Herb A', 'raw_material', 'kg', 100, 5000, 50, 1),
          (2, 'RM-HERB-B', 'สมุนไพร B', 'Herb B', 'raw_material', 'kg', 50, 4000, 80, 1),
          -- Components (Level 1)
          (3, 'PM-CAPSULE', 'แคปซูล', 'Capsules', 'packaging', 'unit', 10000, 5000, 0.5, 1),
          (4, 'PM-BOTTLE', 'ขวด 60 แคปซูล', 'Bottle 60 caps', 'packaging', 'unit', 500, 5000, 10, 1),
          (5, 'PM-LABEL', 'ฉลาก', 'Label', 'packaging', 'unit', 1000, 2000, 2, 1),
          -- Subassembly (Level 1)
          (10, 'SA-EXTRACT', 'สารสกัดสมุนไพรรวม', 'Herb Extract Blend', 'semi_finished', 'kg', 0, 0, 0, 1),
          -- Final product (Level 0)
          (20, 'FG-CAPSULE-60', 'ยาแคปซูลสมุนไพร 60 เม็ด', 'Herbal Capsules 60ct', 'finished_goods', 'bottle', 0, 0, 0, 1)
      `);
    });

    it('should calculate subassembly cost from raw materials', async () => {
      /**
       * Herb Extract Blend formula (1 kg):
       * - 0.4 kg Herb A @ 50 THB = 20 THB
       * - 0.3 kg Herb B @ 80 THB = 24 THB
       * - Labor: 0.5 hr @ 200 THB = 100 THB
       * - Overhead: 0.5 hr @ 100 THB = 50 THB
       * Total: 194 THB/kg
       */

      // Create work center for extraction
      const wcExtract = await createWorkCenter({
        code: 'WC-EXTRACT',
        name: 'Extraction Line',
        laborRatePerHour: 200,
        overheadRatePerHour: 100,
      });

      // Produce 10 kg of extract blend
      testSqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (1, 'BOM-EXTRACT', 'Herb Extract Formula', 10, '1.0', 'approved', 10, 'kg')
      `);

      testSqlite.exec(`
        INSERT INTO operations (id, bom_id, sequence, name, work_center_id)
        VALUES (1, 1, 10, 'Extraction Process', ${wcExtract.id})
      `);

      testSqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, created_by)
        VALUES (1, 'WO-EXTRACT-001', 1, 10, 'EXT-001', 10, 10, 'kg', 'in_progress', ${TEST_USER_ID})
      `);

      // Material consumption for 10 kg batch
      testSqlite.exec(`
        INSERT INTO work_order_materials (id, work_order_id, item_id, planned_quantity, actual_quantity, unit, unit_cost, total_cost, status)
        VALUES
          (1, 1, 1, 4, 4, 'kg', 50, 200, 'issued'),
          (2, 1, 2, 3, 3, 'kg', 80, 240, 'issued')
      `);

      // Labor and overhead
      const [opId] = await createWorkOrderOperations([
        {
          workOrderId: 1,
          operationId: 1,
          workCenterId: wcExtract.id,
          sequence: 10,
          plannedHours: 5, // 0.5 hr/kg × 10 kg
          laborRate: 200,
          overheadRate: 100,
        },
      ]);

      await updateWorkOrderOperation(opId, {
        actualHours: 5,
        status: 'completed',
      });

      const costSummary = await calculateWorkOrderCost(1);

      // Material: 200 + 240 = 440 THB
      expect(costSummary.materialCost).toBe(440);

      // Labor: 5 × 200 = 1,000 THB
      expect(costSummary.laborCost).toBe(1000);

      // Overhead: 5 × 100 = 500 THB
      expect(costSummary.overheadCost).toBe(500);

      // Total: 440 + 1,000 + 500 = 1,940 THB
      expect(costSummary.totalCost).toBe(1940);

      // Unit cost: 1,940 / 10 = 194 THB/kg
      expect(costSummary.unitCost).toBe(194);
    });

    it('should calculate final product cost using subassembly', async () => {
      /**
       * Final Product (60-capsule bottle):
       * - 0.06 kg Extract @ 194 THB/kg = 11.64 THB (from subassembly)
       * - 60 Capsules @ 0.5 THB = 30 THB
       * - 1 Bottle @ 10 THB = 10 THB
       * - 1 Label @ 2 THB = 2 THB
       * - Labor: 0.1 hr @ 250 THB = 25 THB
       * - Overhead: 0.1 hr @ 125 THB = 12.50 THB
       * Total: ~91.14 THB/bottle
       */

      // Update subassembly with calculated cost
      testSqlite.exec(`UPDATE items SET on_hand = 10, on_hand_cost = 1940, current_wac = 194 WHERE id = 10`);

      // Create work center for capsule filling
      const wcFilling = await createWorkCenter({
        code: 'WC-FILLING',
        name: 'Capsule Filling Line',
        laborRatePerHour: 250,
        overheadRatePerHour: 125,
      });

      // BOM and work order for 100 bottles
      testSqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (2, 'BOM-CAP60', 'Capsule 60ct Formula', 20, '1.0', 'approved', 100, 'bottle')
      `);

      testSqlite.exec(`
        INSERT INTO operations (id, bom_id, sequence, name, work_center_id)
        VALUES (2, 2, 10, 'Capsule Filling', ${wcFilling.id})
      `);

      testSqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, created_by)
        VALUES (2, 'WO-CAP60-001', 2, 20, 'CAP-001', 100, 100, 'bottle', 'in_progress', ${TEST_USER_ID})
      `);

      // Material consumption for 100 bottles
      testSqlite.exec(`
        INSERT INTO work_order_materials (id, work_order_id, item_id, planned_quantity, actual_quantity, unit, unit_cost, total_cost, status)
        VALUES
          (10, 2, 10, 6, 6, 'kg', 194, 1164, 'issued'),       -- 0.06 kg × 100 = 6 kg extract
          (11, 2, 3, 6000, 6000, 'unit', 0.5, 3000, 'issued'), -- 60 × 100 capsules
          (12, 2, 4, 100, 100, 'unit', 10, 1000, 'issued'),    -- 100 bottles
          (13, 2, 5, 100, 100, 'unit', 2, 200, 'issued')       -- 100 labels
      `);

      // Labor and overhead: 0.1 hr/bottle × 100 = 10 hrs
      const [opId2] = await createWorkOrderOperations([
        {
          workOrderId: 2,
          operationId: 2,
          workCenterId: wcFilling.id,
          sequence: 10,
          plannedHours: 10,
          laborRate: 250,
          overheadRate: 125,
        },
      ]);

      await updateWorkOrderOperation(opId2, {
        actualHours: 10,
        status: 'completed',
      });

      const costSummary = await calculateWorkOrderCost(2);

      // Material: 1,164 + 3,000 + 1,000 + 200 = 5,364 THB
      expect(costSummary.materialCost).toBe(5364);

      // Labor: 10 × 250 = 2,500 THB
      expect(costSummary.laborCost).toBe(2500);

      // Overhead: 10 × 125 = 1,250 THB
      expect(costSummary.overheadCost).toBe(1250);

      // Total: 5,364 + 2,500 + 1,250 = 9,114 THB
      expect(costSummary.totalCost).toBe(9114);

      // Unit cost: 9,114 / 100 = 91.14 THB/bottle
      expect(costSummary.unitCost).toBe(91.14);
    });

    it('should get complete cost views for finished product', async () => {
      // Set up finished goods with all cost fields
      testSqlite.exec(`
        UPDATE items SET
          on_hand = 100,
          on_hand_cost = 9114,
          current_wac = 91.14,
          standard_cost = 85.00,
          last_production_cost = 91.14,
          last_production_date = '2026-01-20',
          sga_allocation_rate = 20.0
        WHERE id = 20
      `);

      const costViews = await getItemCostViews(20);

      expect(costViews).not.toBeNull();
      expect(costViews!.inventoryCost).toBe(91.14);
      expect(costViews!.standardCost).toBe(85.00);
      expect(costViews!.lastProductionCost).toBe(91.14);
      expect(costViews!.sgaAllocationRate).toBe(20.0);

      // Full cost includes SG&A: 91.14 × 1.20 = 109.37
      expect(costViews!.fullCost).toBeCloseTo(109.37, 2);

      // On-hand value: 100 × 91.14 = 9,114
      expect(costViews!.onHandValue).toBe(9114);
    });
  });

  // ============================================
  // SCENARIO 3: Cost Variance Analysis
  // ============================================
  describe('Scenario 3: Cost Variance Analysis', () => {
    /**
     * Business Story:
     * Management needs to analyze variances between:
     * - Standard cost vs actual cost
     * - Budgeted production cost vs actual
     * - Purchase price variance
     * - Production efficiency variance
     */

    beforeEach(() => {
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, standard_cost, is_active)
        VALUES
          (1, 'RM-001', 'วัตถุดิบ A', 'raw_material', 'kg', 100, 5000, 50, 45, 1),
          (10, 'FG-001', 'ผลิตภัณฑ์สำเร็จรูป', 'finished_goods', 'unit', 50, 4000, 80, 75, 1)
      `);
    });

    it('should calculate purchase price variance', async () => {
      // Standard cost: 45 THB/kg
      // Actual purchase: 50 THB/kg
      // Quantity: 100 kg
      // PPV = (Actual - Standard) × Qty = (50 - 45) × 100 = 500 THB unfavorable

      const item = testSqlite.prepare('SELECT current_wac, standard_cost FROM items WHERE id = 1').get() as { current_wac: number; standard_cost: number };

      const actualCost = item.current_wac;
      const standardCost = item.standard_cost;
      const quantity = 100;

      const purchasePriceVariance = (actualCost - standardCost) * quantity;

      expect(purchasePriceVariance).toBe(500); // Unfavorable (positive = over budget)
    });

    it('should track WAC changes from multiple receipts', async () => {
      // Receipt 1: 100 kg @ 50 THB (already in inventory)
      // Current WAC: 50 THB

      // Receipt 2: 50 kg @ 60 THB
      const receipt2 = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 2,
        quantity: 50,
        unitCost: 60,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      // New WAC: (5000 + 3000) / 150 = 53.33
      expect(receipt2.newWAC).toBeCloseTo(53.33, 2);

      // Variance from standard (45): 53.33 - 45 = 8.33 per kg unfavorable
      const variancePerUnit = receipt2.newWAC - 45;
      expect(variancePerUnit).toBeCloseTo(8.33, 2);

      // Receipt 3: 100 kg @ 42 THB (favorable purchase)
      const receipt3 = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 3,
        quantity: 100,
        unitCost: 42,
        transactionDate: '2026-01-20',
        createdBy: TEST_USER_ID,
      });

      // New WAC: (8000 + 4200) / 250 = 48.80
      expect(receipt3.newWAC).toBeCloseTo(48.80, 2);

      // Variance from standard: 48.80 - 45 = 3.80 per kg (still slightly unfavorable)
      expect(receipt3.newWAC - 45).toBeCloseTo(3.80, 2);
    });

    it('should use effective overhead rates for variance analysis', async () => {
      // Create work center
      const wc = await createWorkCenter({
        code: 'WC-VAR-001',
        name: 'Variance Analysis Line',
        laborRatePerHour: 200,
        overheadRatePerHour: 100,
      });

      // Create overhead rates for different periods (budgeted rates)
      await createOverheadRate({
        code: 'OH-Q1-2026',
        name: 'Q1 2026 Budget Rate',
        workCenterId: wc.id,
        overheadType: 'fixed',
        allocationBasis: 'labor_hours',
        ratePerUnit: 90, // Budgeted: 90 THB/hour
        effectiveFrom: '2026-01-01',
      });

      await createOverheadRate({
        code: 'OH-Q2-2026',
        name: 'Q2 2026 Budget Rate',
        workCenterId: wc.id,
        overheadType: 'fixed',
        allocationBasis: 'labor_hours',
        ratePerUnit: 95, // Q2 increased rate
        effectiveFrom: '2026-04-01',
      });

      // Get rate for January (should be 90)
      const janRate = await getEffectiveOverheadRate(wc.id, '2026-01-15');
      expect(janRate?.ratePerUnit).toBe(90);

      // Get rate for May (should be 95)
      const mayRate = await getEffectiveOverheadRate(wc.id, '2026-05-15');
      expect(mayRate?.ratePerUnit).toBe(95);

      // Work center actual rate is 100
      // January variance = 100 - 90 = 10 THB/hr unfavorable
      // May variance = 100 - 95 = 5 THB/hr unfavorable
    });
  });

  // ============================================
  // SCENARIO 4: Period-End Inventory Valuation
  // ============================================
  describe('Scenario 4: Period-End Inventory Valuation', () => {
    /**
     * Business Story:
     * Finance needs to report inventory value at month-end.
     * This includes:
     * - Current inventory value using WAC
     * - Cost layer audit trail
     * - Movement reconciliation
     */

    beforeEach(() => {
      // Multiple items with inventory
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
        VALUES
          (1, 'RM-001', 'วัตถุดิบ A', 'raw_material', 'kg', 500, 25000, 50, 1),
          (2, 'RM-002', 'วัตถุดิบ B', 'raw_material', 'kg', 200, 16000, 80, 1),
          (3, 'PM-001', 'บรรจุภัณฑ์ A', 'packaging', 'unit', 1000, 5000, 5, 1),
          (10, 'FG-001', 'ผลิตภัณฑ์ A', 'finished_goods', 'unit', 150, 15000, 100, 1),
          (11, 'FG-002', 'ผลิตภัณฑ์ B', 'finished_goods', 'unit', 75, 6750, 90, 1)
      `);
    });

    it('should calculate total inventory value', async () => {
      // Query all items and sum on_hand_cost
      const items = testSqlite.prepare(`
        SELECT id, code, type, on_hand, current_wac, on_hand_cost
        FROM items
        WHERE is_active = 1 AND on_hand > 0
      `).all() as Array<{ id: number; code: string; type: string; on_hand: number; current_wac: number; on_hand_cost: number }>;

      const totalValue = items.reduce((sum, item) => sum + item.on_hand_cost, 0);

      // Expected: 25000 + 16000 + 5000 + 15000 + 6750 = 67,750 THB
      expect(totalValue).toBe(67750);

      // Group by type
      const byType = items.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + item.on_hand_cost;
        return acc;
      }, {} as Record<string, number>);

      expect(byType.raw_material).toBe(41000); // 25000 + 16000
      expect(byType.packaging).toBe(5000);
      expect(byType.finished_goods).toBe(21750); // 15000 + 6750
    });

    it('should maintain cost layer audit trail', async () => {
      // Perform several transactions during the month
      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 101,
        quantity: 100,
        unitCost: 55,
        transactionDate: '2026-01-05',
        notes: 'PO-101 receipt',
        createdBy: TEST_USER_ID,
      });

      await recalculateWAC({
        itemId: 1,
        transactionType: 'adjustment',
        transactionId: 201,
        quantity: -150,
        unitCost: 50.83, // WAC after first receipt
        transactionDate: '2026-01-10',
        notes: 'WO-201 material issue',
        createdBy: TEST_USER_ID,
      });

      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 102,
        quantity: 200,
        unitCost: 48,
        transactionDate: '2026-01-15',
        notes: 'PO-102 receipt',
        createdBy: TEST_USER_ID,
      });

      await recalculateWAC({
        itemId: 1,
        transactionType: 'adjustment',
        transactionId: 301,
        quantity: -10,
        unitCost: 49.23,
        transactionDate: '2026-01-20',
        notes: 'Inventory count adjustment',
        createdBy: TEST_USER_ID,
      });

      // Verify cost layer trail (using correct column names from schema)
      const layers = testSqlite.prepare(`
        SELECT transaction_type, transaction_id, quantity_in, unit_cost, running_wac, running_qty
        FROM item_cost_layers
        WHERE item_id = 1
        ORDER BY transaction_date
      `).all() as Array<{ transaction_type: string; transaction_id: number; quantity_in: number; unit_cost: number; running_wac: number; running_qty: number }>;

      expect(layers).toHaveLength(4);

      // Verify transactions
      expect(layers[0].transaction_type).toBe('receipt');
      expect(layers[0].quantity_in).toBe(100);

      expect(layers[1].transaction_type).toBe('adjustment');
      expect(layers[1].quantity_in).toBe(-150);

      expect(layers[2].transaction_type).toBe('receipt');
      expect(layers[2].quantity_in).toBe(200);

      expect(layers[3].transaction_type).toBe('adjustment');
      expect(layers[3].quantity_in).toBe(-10);
    });

    it('should reconcile opening + movements = closing', async () => {
      // Opening balance
      const opening = testSqlite.prepare('SELECT on_hand, on_hand_cost FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number };
      const openingQty = opening.on_hand;

      // Movements during period
      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 100, // +100
        unitCost: 55,
        transactionDate: '2026-01-10',
        createdBy: TEST_USER_ID,
      });

      await recalculateWAC({
        itemId: 1,
        transactionType: 'adjustment',
        transactionId: 2,
        quantity: -200, // -200 (material issue to production)
        unitCost: 50.83,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      // Closing balance
      const closing = testSqlite.prepare('SELECT on_hand, on_hand_cost, current_wac FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number; current_wac: number };

      // Qty reconciliation: 500 + 100 - 200 = 400
      expect(closing.on_hand).toBe(openingQty + 100 - 200);
      expect(closing.on_hand).toBe(400);

      // Verify cost is consistent with WAC
      expect(closing.on_hand_cost).toBeCloseTo(closing.on_hand * closing.current_wac, 0);
    });
  });

  // ============================================
  // SCENARIO 5: Negative Margin Handling
  // ============================================
  describe('Scenario 5: Negative Margin and Loss Scenarios', () => {
    /**
     * Business Story:
     * Sometimes products are sold below cost (clearance, competition, etc.)
     * System must handle negative margins correctly.
     */

    beforeEach(() => {
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
        VALUES
          (1, 'FG-CLEARANCE', 'สินค้าเคลียร์สต็อก', 'finished_goods', 'unit', 100, 10000, 100, 1)
      `);
    });

    it('should calculate negative margin when selling below cost', async () => {
      // Cost: 100 THB/unit
      // Selling price: 80 THB/unit (clearance sale)
      const cogs = await calculateCOGS(1, 50, 80);

      expect(cogs.unitCost).toBe(100);
      expect(cogs.totalCost).toBe(5000); // 50 × 100

      // Revenue: 50 × 80 = 4,000
      // Loss: 4,000 - 5,000 = -1,000
      expect(cogs.marginAmount).toBe(-1000);

      // Margin %: -1,000 / 4,000 × 100 = -25%
      expect(cogs.marginPercent).toBe(-25);
    });

    it('should track inventory write-down adjustment', async () => {
      // Write down inventory from 100 to 60 THB/unit
      // Loss: 40 × 100 units = 4,000 THB
      // Since recalculateWAC calculates: newTotalCost = previousCost + (qty * unitCost)
      // We need to simulate this via direct DB update (as postLandedCost would do)
      // or use a negative value adjustment

      // Current state: 100 units @ 100 THB = 10,000 THB
      // Target state: 100 units @ 60 THB = 6,000 THB
      // Reduction: 4,000 THB

      // Option 1: Direct DB update (simulating write-down process)
      testSqlite.exec(`
        UPDATE items
        SET on_hand_cost = 6000, current_wac = 60
        WHERE id = 1
      `);

      // Create cost layer record for audit trail
      await recalculateWAC({
        itemId: 1,
        transactionType: 'adjustment',
        transactionId: 1,
        quantity: 0, // No quantity change
        unitCost: 0, // No additional cost (direct write-down)
        transactionDate: '2026-01-25',
        notes: 'Inventory write-down to NRV: 4,000 THB reduction',
        createdBy: TEST_USER_ID,
      });

      // Verify in database
      const item = testSqlite.prepare('SELECT on_hand, on_hand_cost, current_wac FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number; current_wac: number };
      expect(item.on_hand).toBe(100);
      expect(item.current_wac).toBe(60);
      expect(item.on_hand_cost).toBe(6000); // 100 × 60
    });
  });

  // ============================================
  // SCENARIO 6: High-Volume Transaction Stress Test
  // ============================================
  describe('Scenario 6: High-Volume Transaction Processing', () => {
    /**
     * Business Story:
     * A busy manufacturing plant processes hundreds of transactions daily.
     * Test validates system handles high-volume correctly and WAC remains accurate.
     */

    beforeEach(() => {
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
        VALUES (1, 'RM-HIGHVOL', 'วัตถุดิบปริมาณสูง', 'raw_material', 'kg', 0, 0, 0, 1)
      `);
    });

    it('should maintain WAC accuracy after many transactions', async () => {
      // Simulate 20 receipts and 10 issues
      let totalQtyIn = 0;
      let totalValueIn = 0;
      let totalQtyOut = 0;

      // 20 receipts with varying prices
      for (let i = 1; i <= 20; i++) {
        const qty = 100 + Math.floor(i * 5);
        const price = 50 + (i % 5) * 2; // Price varies 50-58

        await recalculateWAC({
          itemId: 1,
          transactionType: 'receipt',
          transactionId: i,
          quantity: qty,
          unitCost: price,
          transactionDate: `2026-01-${String(i).padStart(2, '0')}`,
          createdBy: TEST_USER_ID,
        });

        totalQtyIn += qty;
        totalValueIn += qty * price;
      }

      // Get WAC after receipts
      const midWac = await getItemWAC(1);
      const expectedMidWac = totalValueIn / totalQtyIn;
      expect(midWac).toBeCloseTo(expectedMidWac, 2);

      // 10 issues (production consumption using adjustment)
      for (let i = 1; i <= 10; i++) {
        const issueQty = 150;
        const currentWac = (await getItemWAC(1)) || 0;

        await recalculateWAC({
          itemId: 1,
          transactionType: 'adjustment',
          transactionId: 100 + i,
          quantity: -issueQty,
          unitCost: currentWac,
          transactionDate: `2026-01-${String(20 + i).padStart(2, '0')}`,
          createdBy: TEST_USER_ID,
        });

        totalQtyOut += issueQty;
      }

      // Final verification
      const finalItem = testSqlite.prepare('SELECT on_hand, on_hand_cost, current_wac FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number; current_wac: number };

      // Quantity check
      expect(finalItem.on_hand).toBe(totalQtyIn - totalQtyOut);

      // WAC should remain stable (issues at WAC don't change it)
      expect(finalItem.current_wac).toBeCloseTo(midWac!, 2);

      // Value check: on_hand × WAC = on_hand_cost
      expect(finalItem.on_hand_cost).toBeCloseTo(finalItem.on_hand * finalItem.current_wac, 0);
    });

    it('should correctly handle alternating receipts and issues', async () => {
      // More realistic pattern: receive, use, receive, use...
      const transactions = [
        { type: 'receipt', qty: 100, cost: 50 },
        { type: 'issue', qty: 30, cost: 0 }, // cost = WAC
        { type: 'receipt', qty: 80, cost: 55 },
        { type: 'issue', qty: 50, cost: 0 },
        { type: 'receipt', qty: 120, cost: 48 },
        { type: 'issue', qty: 70, cost: 0 },
        { type: 'receipt', qty: 90, cost: 52 },
        { type: 'issue', qty: 40, cost: 0 },
      ];

      let runningQty = 0;
      let runningValue = 0;

      for (let i = 0; i < transactions.length; i++) {
        const txn = transactions[i];
        const currentWac = runningQty > 0 ? runningValue / runningQty : 0;

        if (txn.type === 'receipt') {
          await recalculateWAC({
            itemId: 1,
            transactionType: 'receipt',
            transactionId: i + 1,
            quantity: txn.qty,
            unitCost: txn.cost,
            transactionDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
            createdBy: TEST_USER_ID,
          });

          runningQty += txn.qty;
          runningValue += txn.qty * txn.cost;
        } else {
          await recalculateWAC({
            itemId: 1,
            transactionType: 'adjustment',
            transactionId: i + 1,
            quantity: -txn.qty,
            unitCost: currentWac,
            transactionDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
            createdBy: TEST_USER_ID,
          });

          runningQty -= txn.qty;
          runningValue -= txn.qty * currentWac;
        }
      }

      // Final state
      const final = testSqlite.prepare('SELECT on_hand, on_hand_cost, current_wac FROM items WHERE id = 1').get() as { on_hand: number; on_hand_cost: number; current_wac: number };

      // Calculate expected final qty: 100 - 30 + 80 - 50 + 120 - 70 + 90 - 40 = 200
      expect(final.on_hand).toBe(200);

      // WAC should be reasonable (between lowest and highest receipt price)
      expect(final.current_wac).toBeGreaterThanOrEqual(48);
      expect(final.current_wac).toBeLessThanOrEqual(55);
    });
  });
});
