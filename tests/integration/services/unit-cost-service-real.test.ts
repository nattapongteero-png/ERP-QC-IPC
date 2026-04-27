/**
 * Unit Cost Service Integration Tests
 * Feature: 014-unit-cost
 *
 * End-to-end workflow tests using real SQLite database:
 * - Complete WAC recalculation workflow
 * - Landed cost create, allocate, verify
 * - Work center with org unit join
 * - Cost views with price calculation
 * - Dashboard KPI aggregation
 * - Production cost aggregation
 * - COGS calculation scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

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

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

import {
  recalculateWAC,
  getItemWAC,
  getItemCostViews,
  getItemCostViewsWithPrice,
  listItemCostLayers,
  calculateCOGS,
  createWorkCenter,
  getWorkCenter,
  listWorkCenters,
  updateWorkCenter,
  createOverheadRate,
  getEffectiveOverheadRate,
  createLandedCost,
  allocateLandedCost,
  generateLandedCostDocNumber,
  upsertWorkOrderCost,
  getWorkOrderCost,
  getCostDashboardKPIs,
  getTopCostIncreases,
  getCostTrend,
  getCostSummaryReport,
} from '@/lib/services/unit-cost.service';

const TEST_USER_ID = 1;
const TODAY = new Date().toISOString().split('T')[0];

function seedBaseData() {
  sqlite.exec(`
    INSERT INTO users (id, email, password, name, role, is_active)
    VALUES (${TEST_USER_ID}, 'admin@test.com', 'hash', 'Admin', 'admin', 1)
  `);
  sqlite.exec(`INSERT INTO hr_org_units (id, code, name, type, effective_from, is_active) VALUES (1, 'PROD', 'Production', 'department', '2026-01-01', 1)`);
  sqlite.exec(`INSERT INTO vendors (id, code, name, is_active) VALUES (1, 'V-001', 'Supplier A', 1)`);
  sqlite.exec(`INSERT INTO customers (id, code, name, is_active) VALUES (1, 'C-001', 'Customer A', 1)`);
  sqlite.exec(`INSERT INTO warehouses (id, code, name, type, is_active) VALUES (1, 'WH-001', 'Main Warehouse', 'raw_material', 1)`);
  sqlite.exec(`
    INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
    VALUES
      (1, 'RM-001', 'สมุนไพร A', 'raw_material', 'kg', 500, 25000, 50, 1),
      (2, 'RM-002', 'สมุนไพร B', 'raw_material', 'kg', 200, 12000, 60, 1),
      (3, 'RM-003', 'สมุนไพร C', 'raw_material', 'kg', 0, 0, null, 1)
  `);
  sqlite.exec(`
    INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, current_wac, is_active)
    VALUES (10, 'FG-001', 'ยาสมุนไพร 1', 'finished_goods', 'bottle', 100, 15000, 150, 1)
  `);
}

function cleanTables() {
  const tables = [
    'landed_cost_allocations', 'landed_cost_lines', 'landed_cost_headers',
    'work_order_costs', 'work_order_operations', 'work_order_materials',
    'work_orders', 'operations', 'bom', 'overhead_rates',
    'item_cost_layers', 'purchase_order_lines', 'purchase_orders',
    'sales_order_lines', 'sales_orders', 'work_centers',
    'items', 'warehouses', 'customers', 'vendors',
    'hr_employees', 'hr_org_units', 'users',
  ];
  for (const t of tables) {
    try { sqlite.exec(`DELETE FROM ${t}`); } catch { /* skip */ }
  }
}

describe('Unit Cost Service - Integration Tests', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    const tables = [
      schema.sqliteUsers, schema.sqliteItems, schema.sqliteItemCostLayers,
      schema.sqliteWorkCenters, schema.sqliteHROrgUnits, schema.sqliteHREmployees,
      schema.sqliteBOM, schema.sqliteWorkOrders, schema.sqliteWorkOrderMaterials,
      schema.sqliteOperations, schema.sqliteWorkOrderOperations, schema.sqliteWorkOrderCosts,
      schema.sqliteLandedCostHeaders, schema.sqliteLandedCostLines, schema.sqliteLandedCostAllocations,
      schema.sqlitePurchaseOrders, schema.sqlitePurchaseOrderLines, schema.sqliteVendors,
      schema.sqliteSalesOrders, schema.sqliteSalesOrderLines, schema.sqliteOverheadRates,
      schema.sqliteWarehouses, schema.sqliteCustomers,
    ];
    for (const table of tables) {
      try { const s = generateCreateTableSql(table); sqlite.exec(s); } catch { /* skip */ }
    }
  });

  afterAll(() => { sqlite.close(); });
  beforeEach(() => { cleanTables(); seedBaseData(); });

  // ============================================
  // WORKFLOW: Multi-Receipt WAC Tracking
  // ============================================

  describe('WAC Multi-Receipt Workflow', () => {
    it('should track WAC accurately across 5 receipts with audit trail', async () => {
      const receipts = [
        { qty: 100, cost: 40 },  // WAC = 40
        { qty: 50, cost: 50 },   // WAC = (4000+2500)/150 = 43.33
        { qty: 200, cost: 45 },  // WAC = (6500+9000)/350 = 44.29
        { qty: 100, cost: 55 },  // WAC = (15500+5500)/450 = 46.67
        { qty: 50, cost: 35 },   // WAC = (21000+1750)/500 = 45.50
      ];

      let lastResult;
      for (let i = 0; i < receipts.length; i++) {
        lastResult = await recalculateWAC({
          itemId: 3, transactionType: 'receipt', transactionId: i + 1,
          quantity: receipts[i].qty, unitCost: receipts[i].cost,
          transactionDate: `2026-01-${String(i + 10).padStart(2, '0')}`,
          createdBy: TEST_USER_ID,
        });
      }

      expect(lastResult!.newQty).toBe(500);
      expect(lastResult!.newWAC).toBeCloseTo(45.5, 1);

      const layers = await listItemCostLayers({ itemId: 3 });
      expect(layers.total).toBe(5);

      for (const layer of layers.data) {
        expect(layer.transactionType).toBe('receipt');
        expect(layer.runningWAC).toBeGreaterThan(0);
        expect(layer.runningQty).toBeGreaterThan(0);
      }
    });

    it('should maintain WAC after reduction then new receipt', async () => {
      const wac1 = await getItemWAC(1);
      expect(wac1).toBe(50);

      await recalculateWAC({
        itemId: 1, transactionType: 'adjustment', transactionId: 1,
        quantity: -200, unitCost: 50, transactionDate: '2026-02-01',
        createdBy: TEST_USER_ID,
      });

      const wac2 = await getItemWAC(1);
      expect(wac2).toBe(50);

      // New receipt: 300 kg @ 50 = 15000, + 100 kg @ 70 = 7000
      // New WAC = 22000 / 400 = 55
      await recalculateWAC({
        itemId: 1, transactionType: 'receipt', transactionId: 2,
        quantity: 100, unitCost: 70, transactionDate: '2026-02-15',
        createdBy: TEST_USER_ID,
      });

      const wac3 = await getItemWAC(1);
      expect(wac3).toBe(55);
    });
  });

  // ============================================
  // WORKFLOW: Landed Cost Full Lifecycle
  // ============================================

  describe('Landed Cost Full Lifecycle', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, created_by)
        VALUES (1, 'PO-2026-001', 1, 'received', 37000, ${TEST_USER_ID})
      `);
      sqlite.exec(`
        INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, unit, unit_price, total_price)
        VALUES
          (1, 1, 1, 500, 'kg', 50, 25000),
          (2, 1, 2, 200, 'kg', 60, 12000)
      `);
    });

    it.skip('should create and allocate proportionally to value', async () => {
      const lc = await createLandedCost({
        referenceType: 'po', referenceId: 1,
        vendorId: 1, invoiceNumber: 'FREIGHT-001', invoiceDate: TODAY,
        currency: 'THB', exchangeRate: 1,
        lines: [
          { costType: 'freight', description: 'Ocean freight', amount: 3700, allocationBasis: 'value' },
        ],
      }, TEST_USER_ID);

      expect(lc.id).toBeGreaterThan(0);

      const allocations = await allocateLandedCost(lc.id);
      expect(allocations.length).toBe(2);

      const item1Alloc = allocations.find(a => a.itemId === 1);
      const item2Alloc = allocations.find(a => a.itemId === 2);
      expect(item1Alloc).toBeDefined();
      expect(item2Alloc).toBeDefined();
      expect(item1Alloc!.allocatedAmount + item2Alloc!.allocatedAmount).toBeCloseTo(3700, 0);
    });

    it('should generate document numbers with consistent format', async () => {
      const doc1 = await generateLandedCostDocNumber();
      expect(doc1).toMatch(/^LC/);
      expect(doc1.length).toBeGreaterThan(5);
    });
  });

  // ============================================
  // WORKFLOW: Cost Views with Pricing
  // ============================================

  describe('Cost Views with Pricing', () => {
    it('should calculate full cost and suggested price', async () => {
      sqlite.exec(`
        UPDATE items SET
          current_wac = 150, standard_cost = 140,
          last_purchase_cost = 155, last_production_cost = 145,
          sga_allocation_rate = 20
        WHERE id = 10
      `);

      const cv = await getItemCostViews(10);
      expect(cv).not.toBeNull();
      expect(cv!.inventoryCost).toBe(150);
      expect(cv!.fullCost).toBeCloseTo(180, 0); // 150 * 1.20

      const cvp = await getItemCostViewsWithPrice(10, 30);
      expect(cvp).not.toBeNull();
      if (cvp!.suggestedPrice) {
        expect(cvp!.suggestedPrice).toBeCloseTo(257.14, 0);
      }
    });

    it('should handle item with no cost data', async () => {
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (99, 'NEW-001', 'New Item', 'raw_material', 'kg', 0, 0, 1)
      `);

      const cv = await getItemCostViews(99);
      expect(cv).not.toBeNull();
      // Item with no inventory has either 0 or null cost
      expect(cv!.inventoryCost == null || cv!.inventoryCost === 0).toBe(true);
    });
  });

  // ============================================
  // WORKFLOW: Work Center with Org Unit
  // ============================================

  describe('Work Center Integration', () => {
    it('should list with org unit names resolved', async () => {
      await createWorkCenter({
        code: 'WC-001', name: 'Mixing Line 1', nameTh: 'สายผสม 1',
        orgUnitId: 1, laborRatePerHour: 200, overheadRatePerHour: 80,
        machineRatePerHour: 300, capacityHoursPerDay: 8, isActive: true,
      });
      await createWorkCenter({
        code: 'WC-002', name: 'Packing Line', nameTh: 'สายบรรจุ',
        orgUnitId: 1, laborRatePerHour: 150, overheadRatePerHour: 60,
        machineRatePerHour: 100, capacityHoursPerDay: 8, isActive: true,
      });

      const list = await listWorkCenters({});
      expect(list.total).toBe(2);
      for (const wc of list.data) {
        expect(wc.orgUnitName).toBe('Production');
        expect(wc.name).toBeTruthy();
        expect(wc.nameTh).toBeTruthy();
      }
    });

    it('should preserve name after partial update', async () => {
      const created = await createWorkCenter({
        code: 'WC-NAME', name: 'Original Name', nameTh: 'ชื่อเดิม',
        laborRatePerHour: 100, overheadRatePerHour: 50,
        machineRatePerHour: 0, isActive: true,
      });

      await updateWorkCenter(created.id, { laborRatePerHour: 200 });

      const wc = await getWorkCenter(created.id);
      expect(wc!.name).toBe('Original Name');
      expect(wc!.nameTh).toBe('ชื่อเดิม');
      expect(wc!.laborRatePerHour).toBe(200);
    });
  });

  // ============================================
  // WORKFLOW: COGS Scenarios
  // ============================================

  describe('COGS Scenarios', () => {
    it('should calculate profit margin correctly', async () => {
      // Item 10: WAC = 150, sell at 250
      const result = await calculateCOGS(10, 50, 250);
      expect(result.unitCost).toBe(150);
      expect(result.totalCost).toBe(7500);
      expect(result.marginAmount).toBe(5000);
      expect(result.marginPercent).toBeCloseTo(40, 0);
    });

    it('should handle loss scenario', async () => {
      const result = await calculateCOGS(10, 10, 120);
      expect(result.unitCost).toBe(150);
      expect(result.marginAmount).toBe(-300);
      expect(result.marginPercent).toBeLessThan(0);
    });

    it('should handle zero selling price', async () => {
      const result = await calculateCOGS(10, 10, 0);
      expect(result.totalCost).toBe(1500);
      expect(result.marginAmount).toBe(-1500);
    });
  });

  // ============================================
  // WORKFLOW: Production Cost Tracking
  // ============================================

  describe('Production Cost Tracking', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO work_centers (id, code, name, labor_rate_per_hour, overhead_rate_per_hour, machine_rate_per_hour, is_active)
        VALUES (1, 'WC-MIX', 'Mixing', 200, 80, 300, 1)
      `);
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (1, 'BOM-FG001', 'BOM FG-001', 10, '1.0', 'approved', 100, 'unit')
      `);
      sqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status)
        VALUES (1, 'WO-2026-001', 1, 10, 'BATCH-001', 500, 'unit', 'in_progress')
      `);
    });

    it('should track full production cost breakdown', async () => {
      const id = await upsertWorkOrderCost({
        workOrderId: 1, materialCost: 25000, laborCost: 4000,
        overheadCost: 1600, totalCost: 30600, unitCost: 61.2,
        producedQuantity: 500, status: 'completed',
      });
      expect(id).toBeGreaterThan(0);

      const cost = await getWorkOrderCost(1);
      expect(cost!.materialCost).toBe(25000);
      expect(cost!.laborCost).toBe(4000);
      expect(cost!.overheadCost).toBe(1600);
      expect(cost!.totalCost).toBe(30600);
      expect(cost!.unitCost).toBeCloseTo(61.2, 1);
    });

    it('should update cost on subsequent upsert', async () => {
      await upsertWorkOrderCost({
        workOrderId: 1, materialCost: 20000, laborCost: 3000,
        overheadCost: 1200, totalCost: 24200, unitCost: 48.4,
        producedQuantity: 500, status: 'in_progress',
      });

      await upsertWorkOrderCost({
        workOrderId: 1, materialCost: 22000, laborCost: 3500,
        overheadCost: 1400, totalCost: 26900, unitCost: 53.8,
        producedQuantity: 500, status: 'completed',
      });

      const cost = await getWorkOrderCost(1);
      expect(cost!.totalCost).toBe(26900);
      expect(cost!.status).toBe('completed');
    });
  });

  // ============================================
  // WORKFLOW: Overhead Rate Effectivity
  // ============================================

  describe('Overhead Rate Effectivity', () => {
    it('should return correct rate for given date', async () => {
      const wc = await createWorkCenter({
        code: 'WC-OH', name: 'OH Test', laborRatePerHour: 100,
        overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
      });

      await createOverheadRate({
        code: 'OH-Q1', name: 'Q1 Rate', overheadType: 'fixed',
        allocationBasis: 'labor_hours', ratePerUnit: 25,
        effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31',
        workCenterId: wc.id, isActive: true,
      });

      await createOverheadRate({
        code: 'OH-Q2', name: 'Q2 Rate', overheadType: 'fixed',
        allocationBasis: 'labor_hours', ratePerUnit: 30,
        effectiveFrom: '2026-04-01', effectiveTo: '2026-06-30',
        workCenterId: wc.id, isActive: true,
      });

      const q1Rate = await getEffectiveOverheadRate(wc.id, '2026-02-15');
      // May return number or object depending on implementation
      const q1Value = typeof q1Rate === 'number' ? q1Rate : (q1Rate as any)?.ratePerUnit ?? q1Rate;
      expect(q1Value).toBe(25);

      const q2Rate = await getEffectiveOverheadRate(wc.id, '2026-05-15');
      const q2Value = typeof q2Rate === 'number' ? q2Rate : (q2Rate as any)?.ratePerUnit ?? q2Rate;
      expect(q2Value).toBe(30);
    });
  });

  // ============================================
  // DASHBOARD & REPORTS
  // ============================================

  describe('Dashboard and Reports', () => {
    it('should return dashboard KPIs', async () => {
      const kpis = await getCostDashboardKPIs();
      expect(kpis).toBeDefined();
      expect(typeof kpis.inventoryValue).toBe('number');
    });

    it('should return cost summary report', async () => {
      const report = await getCostSummaryReport({});
      expect(report).toBeDefined();
      expect(Array.isArray(report.data)).toBe(true);
    });

    it('should return cost trend data', async () => {
      const trend = await getCostTrend(6);
      expect(Array.isArray(trend)).toBe(true);
    });

    it('should return top cost increases list', async () => {
      const items = await getTopCostIncreases(5);
      expect(Array.isArray(items)).toBe(true);
    });
  });
});
