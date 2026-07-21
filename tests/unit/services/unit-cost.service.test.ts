/**
 * Unit Cost Service Unit Tests
 * Feature: 014-unit-cost
 *
 * Tests core service functions:
 * - recalculateWAC() - weighted average cost calculation
 * - getItemWAC() - retrieve current WAC
 * - getItemCostViews() - all cost views for an item
 * - listItemCostLayers() - cost layer audit trail
 * - Work center CRUD operations
 * - Overhead rate operations
 * - Landed cost workflow
 * - Production cost tracking
 * - COGS calculation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

// Create test database
let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module
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
  recalculateWAC,
  getItemWAC,
  getItemCostViews,
  listItemCostLayers,
  calculateFullCost,
  calculateSuggestedPrice,
  calculateCOGS,
  // Work center functions
  listWorkCenters,
  getWorkCenter,
  createWorkCenter,
  updateWorkCenter,
  deleteWorkCenter,
  // Landed cost functions
  generateLandedCostDocNumber,
  createLandedCost,
  getLandedCost,
  updateLandedCost,
  deleteLandedCost,
  listLandedCosts,
  allocateLandedCost,
  // Overhead rate functions
  listOverheadRates,
  getOverheadRate,
  createOverheadRate,
  updateOverheadRate,
  // Production cost functions
  getWorkOrderCost,
  upsertWorkOrderCost,
  getWorkOrderCostSummary,
} from '@/lib/services/unit-cost.service';

// Test data constants
const TEST_USER_ID = 1;
const TEST_ITEM_ID = 1;
const TODAY = new Date().toISOString().split('T')[0];

function seedBaseData() {
  sqlite.exec(`
    INSERT INTO users (id, email, password, name, role, is_active)
    VALUES (${TEST_USER_ID}, 'test@test.com', 'hash', 'Test User', 'admin', 1)
  `);
  sqlite.exec(`
    INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
    VALUES (${TEST_ITEM_ID}, 'RM-001', 'Raw Material 1', 'raw_material', 'kg', 100, 5000, 1)
  `);
}

function cleanTables() {
  const tablesToClean = [
    'landed_cost_allocations', 'landed_cost_lines', 'landed_cost_headers',
    'work_order_costs', 'work_order_operations', 'work_order_materials',
    'work_orders', 'operations', 'bom', 'overhead_rates',
    'item_cost_layers', 'purchase_order_lines', 'purchase_orders',
    'sales_order_lines', 'sales_orders', 'work_centers',
    'items', 'warehouses', 'customers', 'vendors',
    'hr_employees', 'hr_org_units', 'users',
  ];
  for (const table of tablesToClean) {
    try { sqlite.exec(`DELETE FROM ${table}`); } catch { /* skip */ }
  }
}

describe('Unit Cost Service', () => {
  beforeAll(() => {
    sqlite = new Database(':memory:');
    sqlite.exec('PRAGMA journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Create all required tables
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
      try { const sql = generateCreateTableSql(table); sqlite.exec(sql); } catch { /* skip */ }
    }
  });

  afterAll(() => { sqlite.close(); });

  beforeEach(() => {
    cleanTables();
    seedBaseData();
  });

  // ============================================
  // WAC CALCULATION TESTS
  // ============================================

  describe('recalculateWAC', () => {
    it('should calculate WAC correctly for new receipt', async () => {
      // Initial: 100 kg @ 50 THB/kg = 5000 THB total
      // New receipt: 50 kg @ 60 THB/kg = 3000 THB
      // Expected WAC: (5000 + 3000) / (100 + 50) = 53.33
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 60,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.previousWAC).toBe(50);
      expect(result.newWAC).toBeCloseTo(53.3333, 2);
      expect(result.previousQty).toBe(100);
      expect(result.newQty).toBe(150);
      expect(result.costLayerId).toBeGreaterThan(0);
    });

    it('should calculate WAC for first receipt (zero inventory)', async () => {
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (2, 'RM-002', 'New Item', 'raw_material', 'kg', 0, 0, 1)
      `);

      const result = await recalculateWAC({
        itemId: 2,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 100,
        unitCost: 45,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.previousWAC).toBe(0);
      expect(result.newWAC).toBe(45);
      expect(result.newQty).toBe(100);
    });

    it('should handle multiple sequential receipts correctly', async () => {
      await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'receipt', transactionId: 1,
        quantity: 50, unitCost: 60, transactionDate: '2026-01-15', createdBy: TEST_USER_ID,
      });

      // Current: 150 kg, total cost 8000
      // New: 100 kg @ 55 = 5500
      // WAC: 13500 / 250 = 54
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'receipt', transactionId: 2,
        quantity: 100, unitCost: 55, transactionDate: '2026-01-16', createdBy: TEST_USER_ID,
      });

      expect(result.newQty).toBe(250);
      expect(result.newWAC).toBe(54);
    });

    it('should handle adjustment (reduction) at current WAC', async () => {
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'adjustment', transactionId: 1,
        quantity: -20, unitCost: 50, transactionDate: '2026-01-15',
        notes: 'Damaged goods', createdBy: TEST_USER_ID,
      });

      expect(result.newQty).toBe(80);
      expect(result.newWAC).toBe(50);
    });

    it('should prevent negative inventory', async () => {
      await expect(
        recalculateWAC({
          itemId: TEST_ITEM_ID, transactionType: 'adjustment', transactionId: 1,
          quantity: -150, unitCost: 50, transactionDate: '2026-01-15', createdBy: TEST_USER_ID,
        })
      ).rejects.toThrow();
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        recalculateWAC({
          itemId: 9999, transactionType: 'receipt', transactionId: 1,
          quantity: 100, unitCost: 50, transactionDate: '2026-01-15', createdBy: TEST_USER_ID,
        })
      ).rejects.toThrow();
    });

    it('should create cost layer with transaction notes', async () => {
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'landed_cost', transactionId: 1,
        quantity: 0, unitCost: 0, transactionDate: '2026-01-15',
        notes: 'Freight cost allocation', createdBy: TEST_USER_ID,
      });
      expect(result.costLayerId).toBeGreaterThan(0);
    });

    it('should fold a value-only landed cost into WAC without moving quantity', async () => {
      // Start: 100 kg, total cost 5000 (WAC 50). Add 1000 THB of freight/duty
      // as a value-only adjustment: quantity stays 100, total becomes 6000, so
      // WAC rises to 60. Regression guard for the landed-cost-lost bug where a
      // quantity of 0 collapsed `quantity * unitCost` to 0 and the cost vanished.
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'landed_cost',
        transactionId: 1,
        quantity: 0,
        unitCost: 1000, // total landed cost to add
        costAdjustmentOnly: true,
        transactionDate: '2026-01-15',
        notes: 'Landed cost — freight',
        createdBy: TEST_USER_ID,
      });

      expect(result.previousWAC).toBe(50);
      expect(result.previousQty).toBe(100);
      expect(result.newQty).toBe(100); // quantity unchanged
      expect(result.newWAC).toBe(60);  // (5000 + 1000) / 100
    });

    it('should NOT change WAC when a value-only flag is absent and quantity is 0 (old behaviour)', async () => {
      // Without costAdjustmentOnly, quantity:0 means quantity * unitCost = 0, so
      // the item value is untouched. This documents exactly why postLandedCost
      // must set the flag.
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'landed_cost',
        transactionId: 2,
        quantity: 0,
        unitCost: 1000,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.previousWAC).toBe(50);
      expect(result.newWAC).toBe(50); // unchanged — the cost was NOT added
    });
  });

  // ============================================
  // getItemWAC TESTS
  // ============================================

  describe('getItemWAC', () => {
    it('should return current WAC when set', async () => {
      sqlite.exec(`UPDATE items SET current_wac = 55.5 WHERE id = ${TEST_ITEM_ID}`);
      const wac = await getItemWAC(TEST_ITEM_ID);
      expect(wac).toBe(55.5);
    });

    it('should calculate WAC from on_hand_cost/on_hand if current_wac is null', async () => {
      const wac = await getItemWAC(TEST_ITEM_ID);
      expect(wac).toBe(50); // 5000/100
    });

    it('should return null for non-existent item', async () => {
      const wac = await getItemWAC(9999);
      expect(wac).toBeNull();
    });

    it('should return 0 for item with zero inventory', async () => {
      sqlite.exec(`UPDATE items SET on_hand = 0, on_hand_cost = 0, current_wac = NULL WHERE id = ${TEST_ITEM_ID}`);
      const wac = await getItemWAC(TEST_ITEM_ID);
      expect(wac).toBe(0);
    });
  });

  // ============================================
  // getItemCostViews TESTS
  // ============================================

  describe('getItemCostViews', () => {
    it('should return all cost perspectives', async () => {
      sqlite.exec(`
        UPDATE items SET
          current_wac = 52.5, standard_cost = 50.0,
          last_purchase_cost = 55.0, last_purchase_date = '2026-01-10',
          last_production_cost = 48.0, last_production_date = '2026-01-12',
          sga_allocation_rate = 15.0
        WHERE id = ${TEST_ITEM_ID}
      `);

      const cv = await getItemCostViews(TEST_ITEM_ID);
      expect(cv).not.toBeNull();
      expect(cv!.itemId).toBe(TEST_ITEM_ID);
      expect(cv!.inventoryCost).toBe(52.5);
      expect(cv!.standardCost).toBe(50.0);
      expect(cv!.lastPurchaseCost).toBe(55.0);
      expect(cv!.lastProductionCost).toBe(48.0);
      expect(cv!.sgaAllocationRate).toBe(15.0);
      expect(cv!.fullCost).toBeCloseTo(60.375, 2); // 52.5 * 1.15
      expect(cv!.onHandValue).toBe(5250); // 100 * 52.5
    });

    it('should return null for non-existent item', async () => {
      expect(await getItemCostViews(9999)).toBeNull();
    });

    it('should handle item with no cost data', async () => {
      const cv = await getItemCostViews(TEST_ITEM_ID);
      expect(cv).not.toBeNull();
      expect(cv!.itemId).toBe(TEST_ITEM_ID);
    });
  });

  // ============================================
  // Pure Calculation Functions
  // ============================================

  describe('calculateFullCost', () => {
    it('should calculate with SGA allocation', () => {
      expect(calculateFullCost(100, 15)).toBeCloseTo(115, 0);
    });
    it('should return null for null input', () => {
      expect(calculateFullCost(null, 15)).toBeNull();
    });
    it('should handle zero SGA', () => {
      expect(calculateFullCost(100, 0)).toBe(100);
    });
  });

  describe('calculateSuggestedPrice', () => {
    it('should calculate price from margin', () => {
      // Price = 100 / (1 - 0.20) = 125
      expect(calculateSuggestedPrice(100, 20)).toBeCloseTo(125, 0);
    });
    it('should return null for null input', () => {
      expect(calculateSuggestedPrice(null, 20)).toBeNull();
    });
    it('should handle zero margin', () => {
      expect(calculateSuggestedPrice(100, 0)).toBe(100);
    });
  });

  // ============================================
  // listItemCostLayers TESTS
  // ============================================

  describe('listItemCostLayers', () => {
    it('should return empty when no layers exist', async () => {
      const result = await listItemCostLayers({ itemId: TEST_ITEM_ID });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return layers after WAC recalculations', async () => {
      await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'receipt', transactionId: 1,
        quantity: 50, unitCost: 60, transactionDate: '2026-01-15', createdBy: TEST_USER_ID,
      });
      await recalculateWAC({
        itemId: TEST_ITEM_ID, transactionType: 'receipt', transactionId: 2,
        quantity: 30, unitCost: 55, transactionDate: '2026-01-16', createdBy: TEST_USER_ID,
      });

      const result = await listItemCostLayers({ itemId: TEST_ITEM_ID });
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should paginate results', async () => {
      for (let i = 1; i <= 5; i++) {
        await recalculateWAC({
          itemId: TEST_ITEM_ID, transactionType: 'receipt', transactionId: i,
          quantity: 10, unitCost: 50 + i,
          transactionDate: `2026-01-${String(i + 10).padStart(2, '0')}`,
          createdBy: TEST_USER_ID,
        });
      }
      const page1 = await listItemCostLayers({ itemId: TEST_ITEM_ID, page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(5);
    });
  });

  // ============================================
  // WORK CENTER CRUD TESTS
  // ============================================

  describe('Work Centers', () => {
    it('should create a work center', async () => {
      const result = await createWorkCenter({
        code: 'WC-MIX-01', name: 'Mixing Station 1', nameTh: 'สถานีผสม 1',
        orgUnitId: null, laborRatePerHour: 150, overheadRatePerHour: 50,
        machineRatePerHour: 200, capacityHoursPerDay: 8, isActive: true,
      });
      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('WC-MIX-01');
    });

    it('should reject duplicate code', async () => {
      await createWorkCenter({
        code: 'WC-DUP', name: 'First', laborRatePerHour: 100,
        overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
      });
      await expect(
        createWorkCenter({
          code: 'WC-DUP', name: 'Second', laborRatePerHour: 100,
          overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
        })
      ).rejects.toThrow();
    });

    it('should get work center by ID with correct name', async () => {
      const created = await createWorkCenter({
        code: 'WC-GET', name: 'Get Test', nameTh: 'ทดสอบ',
        laborRatePerHour: 100, overheadRatePerHour: 30,
        machineRatePerHour: 50, capacityHoursPerDay: 8, isActive: true,
      });

      const wc = await getWorkCenter(created.id);
      expect(wc).not.toBeNull();
      expect(wc!.code).toBe('WC-GET');
      expect(wc!.name).toBe('Get Test');
      expect(wc!.nameTh).toBe('ทดสอบ');
      expect(wc!.laborRatePerHour).toBe(100);
      expect(wc!.overheadRatePerHour).toBe(30);
      expect(wc!.machineRatePerHour).toBe(50);
    });

    it('should return null for non-existent work center', async () => {
      expect(await getWorkCenter(9999)).toBeNull();
    });

    it('should update work center fields', async () => {
      const created = await createWorkCenter({
        code: 'WC-UPD', name: 'Before', laborRatePerHour: 100,
        overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
      });

      await updateWorkCenter(created.id, { name: 'After', laborRatePerHour: 200 });

      const updated = await getWorkCenter(created.id);
      expect(updated!.name).toBe('After');
      expect(updated!.laborRatePerHour).toBe(200);
    });

    it('should delete (deactivate) work center', async () => {
      const created = await createWorkCenter({
        code: 'WC-DEL', name: 'To Delete', laborRatePerHour: 100,
        overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
      });

      await deleteWorkCenter(created.id);
      const deleted = await getWorkCenter(created.id);
      if (deleted) { expect(deleted.isActive).toBe(false); }
    });

    it('should list with pagination', async () => {
      await createWorkCenter({ code: 'WC-A', name: 'Alpha', laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true });
      await createWorkCenter({ code: 'WC-B', name: 'Beta', laborRatePerHour: 150, overheadRatePerHour: 60, machineRatePerHour: 0, isActive: true });
      await createWorkCenter({ code: 'WC-C', name: 'Charlie', laborRatePerHour: 200, overheadRatePerHour: 70, machineRatePerHour: 0, isActive: false });

      const all = await listWorkCenters({});
      expect(all.total).toBe(3);

      const page1 = await listWorkCenters({ page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
    });

    it('should filter by active status', async () => {
      await createWorkCenter({ code: 'WC-ACT', name: 'Active', laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true });
      await createWorkCenter({ code: 'WC-INA', name: 'Inactive', laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: false });

      const active = await listWorkCenters({ isActive: true });
      expect(active.data.every(wc => wc.isActive)).toBe(true);
    });

    it('should search by name or code', async () => {
      await createWorkCenter({ code: 'WC-SEARCH', name: 'Mixing Station', laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true });
      await createWorkCenter({ code: 'WC-OTHER', name: 'Packing', laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true });

      const result = await listWorkCenters({ search: 'Mixing' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toBe('Mixing Station');
    });

    it('should include org unit name', async () => {
      sqlite.exec(`INSERT INTO hr_org_units (id, code, name, type, effective_from, is_active) VALUES (1, 'OU-001', 'Production Dept', 'department', '2026-01-01', 1)`);

      const created = await createWorkCenter({
        code: 'WC-OU', name: 'With Org', orgUnitId: 1,
        laborRatePerHour: 100, overheadRatePerHour: 50, machineRatePerHour: 0, isActive: true,
      });

      const wc = await getWorkCenter(created.id);
      expect(wc!.orgUnitName).toBe('Production Dept');
    });
  });

  // ============================================
  // OVERHEAD RATE TESTS
  // ============================================

  describe('Overhead Rates', () => {
    it('should create an overhead rate', async () => {
      const result = await createOverheadRate({
        code: 'OH-001', name: 'Factory Overhead', overheadType: 'fixed',
        allocationBasis: 'labor_hours', ratePerUnit: 25.0,
        effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', isActive: true,
      });
      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('OH-001');
    });

    it('should get overhead rate by ID', async () => {
      const created = await createOverheadRate({
        code: 'OH-GET', name: 'Get Test', overheadType: 'variable',
        allocationBasis: 'machine_hours', ratePerUnit: 30.0,
        effectiveFrom: '2026-01-01', isActive: true,
      });
      const rate = await getOverheadRate(created.id);
      expect(rate).not.toBeNull();
      expect(rate!.code).toBe('OH-GET');
      expect(rate!.ratePerUnit).toBe(30.0);
    });

    it('should update overhead rate', async () => {
      const created = await createOverheadRate({
        code: 'OH-UPD', name: 'Before', overheadType: 'fixed',
        allocationBasis: 'labor_hours', ratePerUnit: 20.0,
        effectiveFrom: '2026-01-01', isActive: true,
      });
      await updateOverheadRate(created.id, { name: 'After', ratePerUnit: 35.0 });
      const updated = await getOverheadRate(created.id);
      expect(updated!.name).toBe('After');
      expect(updated!.ratePerUnit).toBe(35.0);
    });

    it('should list overhead rates with pagination', async () => {
      await createOverheadRate({ code: 'OH-L1', name: 'R1', overheadType: 'fixed', allocationBasis: 'labor_hours', ratePerUnit: 10, effectiveFrom: '2026-01-01', isActive: true });
      await createOverheadRate({ code: 'OH-L2', name: 'R2', overheadType: 'variable', allocationBasis: 'machine_hours', ratePerUnit: 20, effectiveFrom: '2026-01-01', isActive: true });

      const result = await listOverheadRates({});
      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  // ============================================
  // LANDED COST TESTS
  // ============================================

  describe('Landed Costs', () => {
    beforeEach(() => {
      sqlite.exec(`INSERT INTO vendors (id, code, name, is_active) VALUES (1, 'V-001', 'Test Vendor', 1)`);
      sqlite.exec(`
        INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, created_by)
        VALUES (1, 'PO-001', 1, 'received', 10000, ${TEST_USER_ID})
      `);
      sqlite.exec(`
        INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, unit, unit_price, total_price)
        VALUES (1, 1, ${TEST_ITEM_ID}, 100, 'kg', 50, 5000)
      `);
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (2, 'RM-002', 'Raw Material 2', 'raw_material', 'kg', 50, 2500, 1)
      `);
      sqlite.exec(`
        INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, unit, unit_price, total_price)
        VALUES (2, 1, 2, 50, 'kg', 50, 2500)
      `);
    });

    it('should generate unique document numbers', async () => {
      const doc = await generateLandedCostDocNumber();
      expect(doc).toMatch(/^LC/);
    });

    it('should create landed cost with lines', async () => {
      const result = await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, invoiceNumber: 'INV-001', invoiceDate: TODAY,
        currency: 'THB', exchangeRate: 1,
        lines: [
          { costType: 'freight', description: 'Shipping', amount: 500, allocationBasis: 'value' },
          { costType: 'duty', description: 'Import duty', amount: 300, allocationBasis: 'value' },
        ],
      }, TEST_USER_ID);

      expect(result.id).toBeGreaterThan(0);
      expect(result.documentNumber).toMatch(/^LC/);
    });

    it('should get landed cost with lines', async () => {
      const created = await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, currency: 'THB', exchangeRate: 1,
        lines: [{ costType: 'freight', description: 'Shipping', amount: 500, allocationBasis: 'value' }],
      }, TEST_USER_ID);

      const lc = await getLandedCost(created.id);
      expect(lc).not.toBeNull();
      expect(lc!.status).toBe('draft');
    });

    it('should list landed costs', async () => {
      await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, currency: 'THB', exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
      }, TEST_USER_ID);

      const result = await listLandedCosts({});
      expect(result.data.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should update draft landed cost', async () => {
      const created = await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, currency: 'THB', exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
      }, TEST_USER_ID);

      await updateLandedCost(created.id, { invoiceNumber: 'INV-UPD' });
      const updated = await getLandedCost(created.id);
      expect(updated!.invoiceNumber).toBe('INV-UPD');
    });

    it('should delete draft landed cost', async () => {
      const created = await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, currency: 'THB', exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
      }, TEST_USER_ID);

      await deleteLandedCost(created.id);
      expect(await getLandedCost(created.id)).toBeNull();
    });

    it.skip('should allocate cost to PO items by value', async () => {
      const created = await createLandedCost({
        referenceType: 'po', referenceId: 1,         vendorId: 1, currency: 'THB', exchangeRate: 1,
        lines: [{ costType: 'freight', description: 'Freight', amount: 750, allocationBasis: 'value' }],
      }, TEST_USER_ID);

      const allocations = await allocateLandedCost(created.id);
      expect(allocations.length).toBeGreaterThan(0);

      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBeCloseTo(750, 0);
    });
  });

  // ============================================
  // COGS CALCULATION TESTS
  // ============================================

  describe('calculateCOGS', () => {
    it('should calculate COGS and margin', async () => {
      sqlite.exec(`UPDATE items SET current_wac = 50 WHERE id = ${TEST_ITEM_ID}`);

      const result = await calculateCOGS(TEST_ITEM_ID, 10, 80);
      expect(result.unitCost).toBe(50);
      expect(result.totalCost).toBe(500);
      expect(result.marginAmount).toBe(300);
      expect(result.marginPercent).toBeCloseTo(37.5, 1);
    });

    it('should handle item with zero WAC', async () => {
      sqlite.exec(`UPDATE items SET current_wac = 0, on_hand = 0, on_hand_cost = 0 WHERE id = ${TEST_ITEM_ID}`);

      const result = await calculateCOGS(TEST_ITEM_ID, 10, 80);
      expect(result.unitCost).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.marginAmount).toBe(800);
    });
  });

  // ============================================
  // WORK ORDER COST TESTS
  // ============================================

  describe('Work Order Costs', () => {
    const WO_ID = 1;

    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO work_centers (id, code, name, labor_rate_per_hour, overhead_rate_per_hour, machine_rate_per_hour, is_active)
        VALUES (1, 'WC-PROD', 'Production Line', 150, 50, 200, 1)
      `);
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (10, 'FG-001', 'Finished Good', 'finished_goods', 'unit', 0, 0, 1)
      `);
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit)
        VALUES (1, 'BOM-001', 'BOM FG-001', 10, '1.0', 'approved', 100, 'unit')
      `);
      sqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status)
        VALUES (${WO_ID}, 'WO-001', 1, 10, 'BATCH-001', 100, 'unit', 'in_progress')
      `);
    });

    it('should upsert work order cost', async () => {
      const id = await upsertWorkOrderCost({
        workOrderId: WO_ID, materialCost: 5000, laborCost: 1200,
        overheadCost: 400, totalCost: 6600, unitCost: 66,
        producedQuantity: 100, status: 'in_progress',
      });
      expect(id).toBeGreaterThan(0);

      const cost = await getWorkOrderCost(WO_ID);
      expect(cost).not.toBeNull();
      expect(cost!.materialCost).toBe(5000);
      expect(cost!.laborCost).toBe(1200);
      expect(cost!.totalCost).toBe(6600);
      expect(cost!.unitCost).toBe(66);
    });

    it('should get cost summary', async () => {
      await upsertWorkOrderCost({
        workOrderId: WO_ID, materialCost: 5000, laborCost: 1200,
        overheadCost: 400, totalCost: 6600, unitCost: 66,
        producedQuantity: 100, status: 'completed',
      });

      const summary = await getWorkOrderCostSummary(WO_ID);
      expect(summary).not.toBeNull();
    });

    it('should return null for non-existent WO cost', async () => {
      expect(await getWorkOrderCost(9999)).toBeNull();
    });
  });
});
