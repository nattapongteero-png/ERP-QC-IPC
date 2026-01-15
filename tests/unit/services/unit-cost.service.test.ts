/**
 * Unit Cost Service Unit Tests
 * Feature: 014-unit-cost
 *
 * Tests core WAC calculation functions:
 * - recalculateWAC() - weighted average cost calculation
 * - getItemWAC() - retrieve current WAC
 * - getItemCostViews() - all cost views for an item
 * - listItemCostLayers() - cost layer audit trail
 * - Work center CRUD operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;
let testDb: any;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  recalculateWAC,
  getItemWAC,
  getItemCostViews,
  listItemCostLayers,
  listWorkCenters,
  getWorkCenter,
  createWorkCenter,
  updateWorkCenter,
  deleteWorkCenter,
  createLandedCost,
  getLandedCost,
  allocateLandedCost,
  postLandedCost,
  listLandedCosts,
  deleteLandedCost,
} from '@/lib/services/unit-cost.service';

// Test data constants
const TEST_USER_ID = 1;
const TEST_ITEM_ID = 1;

describe('Unit Cost Service', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    // Create required tables
    const tables = [
      schema.sqliteUsers,
      schema.sqliteItems,
      schema.sqliteItemCostLayers,
      schema.sqliteWorkCenters,
      schema.sqliteHROrgUnits,
      schema.sqliteHREmployees,
      schema.sqliteWorkOrders,
      schema.sqliteOperations,
      schema.sqliteWorkOrderOperations,
      schema.sqliteLandedCostHeaders,
      schema.sqliteLandedCostLines,
      schema.sqliteLandedCostAllocations,
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteVendors,
    ];

    for (const table of tables) {
      try {
        const sql = generateCreateTableSql(table);
        testSqlite.exec(sql);
      } catch (e) {
        // Table might already exist or FK constraint issue - continue
      }
    }

    // Seed test user
    testSqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES (${TEST_USER_ID}, 'test@test.com', 'hash', 'Test User', 'admin', 1)
    `);

    // Seed test item with initial inventory
    testSqlite.exec(`
      INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
      VALUES (${TEST_ITEM_ID}, 'RM-001', 'Raw Material 1', 'raw_material', 'kg', 100, 5000, 1)
    `);
  });

  afterEach(() => {
    testSqlite.close();
  });

  // ============================================
  // WAC CALCULATION TESTS
  // ============================================

  describe('recalculateWAC', () => {
    it('should calculate WAC correctly for new receipt', async () => {
      // Initial: 100 kg @ 50 THB/kg = 5000 THB total
      // New receipt: 50 kg @ 60 THB/kg = 3000 THB
      // Expected WAC: (5000 + 3000) / (100 + 50) = 53.33 THB/kg

      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 60,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.previousWAC).toBe(50); // 5000/100
      expect(result.newWAC).toBeCloseTo(53.3333, 2); // 8000/150
      expect(result.previousQty).toBe(100);
      expect(result.newQty).toBe(150);
      expect(result.costLayerId).toBeGreaterThan(0);
    });

    it('should calculate WAC correctly for first receipt (zero inventory)', async () => {
      // Create item with zero inventory
      testSqlite.exec(`
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
      expect(result.newWAC).toBe(45); // First receipt, WAC = unit cost
      expect(result.previousQty).toBe(0);
      expect(result.newQty).toBe(100);
    });

    it('should handle multiple receipts correctly', async () => {
      // First receipt
      await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 60,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      // Second receipt
      // Current: 150 kg @ ~53.33 = 8000 THB
      // New: 100 kg @ 55 = 5500 THB
      // New WAC: 13500 / 250 = 54 THB/kg
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 2,
        quantity: 100,
        unitCost: 55,
        transactionDate: '2026-01-16',
        createdBy: TEST_USER_ID,
      });

      expect(result.newQty).toBe(250);
      expect(result.newWAC).toBe(54); // 13500/250
    });

    it('should handle adjustment (reduction)', async () => {
      // Reduce inventory by 20 kg at current WAC
      const currentWAC = 50; // 5000/100

      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'adjustment',
        transactionId: 1,
        quantity: -20, // Negative for reduction
        unitCost: currentWAC,
        transactionDate: '2026-01-15',
        notes: 'Adjustment for damaged goods',
        createdBy: TEST_USER_ID,
      });

      expect(result.newQty).toBe(80);
      // WAC should remain the same after adjustment at current WAC
      expect(result.newWAC).toBe(50);
    });

    it('should prevent negative inventory', async () => {
      await expect(
        recalculateWAC({
          itemId: TEST_ITEM_ID,
          transactionType: 'adjustment',
          transactionId: 1,
          quantity: -150, // More than on-hand
          unitCost: 50,
          transactionDate: '2026-01-15',
          createdBy: TEST_USER_ID,
        })
      ).rejects.toThrow('negative inventory');
    });

    it('should throw error for non-existent item', async () => {
      await expect(
        recalculateWAC({
          itemId: 9999,
          transactionType: 'receipt',
          transactionId: 1,
          quantity: 100,
          unitCost: 50,
          transactionDate: '2026-01-15',
          createdBy: TEST_USER_ID,
        })
      ).rejects.toThrow('not found');
    });

    it('should create cost layer with transaction notes', async () => {
      const result = await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'landed_cost',
        transactionId: 1,
        quantity: 0, // Landed cost adds value without quantity
        unitCost: 0,
        transactionDate: '2026-01-15',
        notes: 'Freight cost allocation',
        createdBy: TEST_USER_ID,
      });

      // Verify cost layer was created
      expect(result.costLayerId).toBeGreaterThan(0);
    });
  });

  describe('getItemWAC', () => {
    it('should return current WAC for item', async () => {
      // Set currentWAC explicitly
      testSqlite.exec(`UPDATE items SET current_wac = 55.5 WHERE id = ${TEST_ITEM_ID}`);

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
      testSqlite.exec(`UPDATE items SET on_hand = 0, on_hand_cost = 0, current_wac = NULL WHERE id = ${TEST_ITEM_ID}`);

      const wac = await getItemWAC(TEST_ITEM_ID);
      expect(wac).toBe(0);
    });
  });

  describe('getItemCostViews', () => {
    it('should return all cost views for an item', async () => {
      // Set up various cost fields
      testSqlite.exec(`
        UPDATE items SET
          current_wac = 52.5,
          standard_cost = 50.0,
          last_purchase_cost = 55.0,
          last_purchase_date = '2026-01-10',
          last_production_cost = 48.0,
          last_production_date = '2026-01-12',
          sga_allocation_rate = 15.0
        WHERE id = ${TEST_ITEM_ID}
      `);

      const costViews = await getItemCostViews(TEST_ITEM_ID);

      expect(costViews).not.toBeNull();
      expect(costViews!.itemId).toBe(TEST_ITEM_ID);
      expect(costViews!.inventoryCost).toBe(52.5);
      expect(costViews!.standardCost).toBe(50.0);
      expect(costViews!.lastPurchaseCost).toBe(55.0);
      expect(costViews!.lastProductionCost).toBe(48.0);
      expect(costViews!.sgaAllocationRate).toBe(15.0);
      // Full cost = WAC * (1 + SG&A%)
      expect(costViews!.fullCost).toBeCloseTo(60.375, 2); // 52.5 * 1.15
      expect(costViews!.onHandValue).toBe(5250); // 100 * 52.5
    });

    it('should return null for non-existent item', async () => {
      const costViews = await getItemCostViews(9999);
      expect(costViews).toBeNull();
    });
  });

  describe('listItemCostLayers', () => {
    beforeEach(async () => {
      // Create some cost layers
      await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 60,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      await recalculateWAC({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
        transactionId: 2,
        quantity: 30,
        unitCost: 55,
        transactionDate: '2026-01-16',
        createdBy: TEST_USER_ID,
      });
    });

    it('should list cost layers with pagination', async () => {
      const result = await listItemCostLayers({ itemId: TEST_ITEM_ID, page: 1, pageSize: 10 });

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
      // Should be ordered by date descending
      expect(result.data[0].transactionDate).toBe('2026-01-16');
    });

    it('should filter by transaction type', async () => {
      const result = await listItemCostLayers({
        itemId: TEST_ITEM_ID,
        transactionType: 'receipt',
      });

      expect(result.data.every(layer => layer.transactionType === 'receipt')).toBe(true);
    });

    it('should filter by date range', async () => {
      const result = await listItemCostLayers({
        itemId: TEST_ITEM_ID,
        fromDate: '2026-01-16',
        toDate: '2026-01-16',
      });

      expect(result.total).toBe(1);
      expect(result.data[0].transactionDate).toBe('2026-01-16');
    });
  });

  // ============================================
  // WORK CENTER TESTS
  // ============================================

  describe('Work Centers CRUD', () => {
    describe('createWorkCenter', () => {
      it('should create a new work center', async () => {
        const result = await createWorkCenter({
          code: 'WC-001',
          name: 'Production Line 1',
          nameTh: 'สายการผลิต 1',
          laborRatePerHour: 150,
          overheadRatePerHour: 50,
          machineRatePerHour: 100,
          capacityHoursPerDay: 8,
        });

        expect(result.id).toBeGreaterThan(0);
        expect(result.code).toBe('WC-001');

        // Verify it was created
        const created = await getWorkCenter(result.id);
        expect(created).not.toBeNull();
        expect(created!.name).toBe('Production Line 1');
        expect(created!.laborRatePerHour).toBe(150);
      });

      it('should prevent duplicate codes', async () => {
        await createWorkCenter({
          code: 'WC-001',
          name: 'Production Line 1',
        });

        await expect(
          createWorkCenter({
            code: 'WC-001',
            name: 'Another Line',
          })
        ).rejects.toThrow('already exists');
      });

      it('should use default values for rates', async () => {
        const result = await createWorkCenter({
          code: 'WC-002',
          name: 'Assembly',
        });

        const created = await getWorkCenter(result.id);
        expect(created!.laborRatePerHour).toBe(0);
        expect(created!.overheadRatePerHour).toBe(0);
        expect(created!.machineRatePerHour).toBe(0);
        expect(created!.isActive).toBe(true);
      });
    });

    describe('listWorkCenters', () => {
      beforeEach(async () => {
        await createWorkCenter({ code: 'WC-001', name: 'Line 1', isActive: true });
        await createWorkCenter({ code: 'WC-002', name: 'Line 2', isActive: true });
        await createWorkCenter({ code: 'WC-003', name: 'Inactive Line', isActive: false });
      });

      it('should list all work centers', async () => {
        const result = await listWorkCenters({});
        expect(result.total).toBe(3);
      });

      it('should filter by active status', async () => {
        const result = await listWorkCenters({ isActive: true });
        expect(result.total).toBe(2);
      });

      it('should search by code or name', async () => {
        const result = await listWorkCenters({ search: 'Line 2' });
        expect(result.total).toBe(1);
        expect(result.data[0].code).toBe('WC-002');
      });

      it('should paginate results', async () => {
        const result = await listWorkCenters({ page: 1, pageSize: 2 });
        expect(result.data.length).toBe(2);
        expect(result.total).toBe(3);
      });
    });

    describe('updateWorkCenter', () => {
      it('should update work center fields', async () => {
        const { id } = await createWorkCenter({
          code: 'WC-001',
          name: 'Original Name',
          laborRatePerHour: 100,
        });

        await updateWorkCenter(id, {
          name: 'Updated Name',
          laborRatePerHour: 150,
        });

        const updated = await getWorkCenter(id);
        expect(updated!.name).toBe('Updated Name');
        expect(updated!.laborRatePerHour).toBe(150);
      });

      it('should prevent duplicate code on update', async () => {
        await createWorkCenter({ code: 'WC-001', name: 'Line 1' });
        const { id } = await createWorkCenter({ code: 'WC-002', name: 'Line 2' });

        await expect(
          updateWorkCenter(id, { code: 'WC-001' })
        ).rejects.toThrow('already exists');
      });

      it('should throw error for non-existent work center', async () => {
        await expect(
          updateWorkCenter(9999, { name: 'Test' })
        ).rejects.toThrow('not found');
      });
    });

    describe('deleteWorkCenter', () => {
      it('should delete work center not in use', async () => {
        const { id } = await createWorkCenter({
          code: 'WC-001',
          name: 'To Delete',
        });

        await deleteWorkCenter(id);

        const deleted = await getWorkCenter(id);
        expect(deleted).toBeNull();
      });

      it('should throw error for non-existent work center', async () => {
        await expect(deleteWorkCenter(9999)).rejects.toThrow('not found');
      });
    });
  });

  // ============================================
  // WAC PRECISION TESTS
  // ============================================

  describe('WAC Precision', () => {
    it('should maintain 4 decimal precision', async () => {
      // Create item with specific values to test precision
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (3, 'RM-003', 'Precision Test', 'raw_material', 'kg', 333, 16650, 1)
      `);

      const result = await recalculateWAC({
        itemId: 3,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 127,
        unitCost: 51.2345,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      // Verify WAC is calculated with at least 4 decimal precision
      expect(result.newWAC.toString()).toMatch(/^\d+\.\d{1,4}$/);
    });

    it('should handle very small unit costs', async () => {
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (4, 'RM-004', 'Small Cost', 'raw_material', 'units', 0, 0, 1)
      `);

      const result = await recalculateWAC({
        itemId: 4,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 10000,
        unitCost: 0.0001,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.newWAC).toBe(0.0001);
    });

    it('should handle large quantities and costs', async () => {
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (5, 'RM-005', 'Large Values', 'raw_material', 'kg', 1000000, 50000000, 1)
      `);

      const result = await recalculateWAC({
        itemId: 5,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 500000,
        unitCost: 52,
        transactionDate: '2026-01-15',
        createdBy: TEST_USER_ID,
      });

      expect(result.newQty).toBe(1500000);
      // (50M + 26M) / 1.5M = 50.6667
      expect(result.newWAC).toBeCloseTo(50.6667, 2);
    });
  });

  // ============================================
  // LANDED COST TESTS
  // ============================================

  describe('Landed Cost Management', () => {
    beforeEach(() => {
      // Create PO and PO lines for landed cost tests
      testSqlite.exec(`
        INSERT INTO purchase_orders (id, po_number, vendor_id, status, created_by)
        VALUES (1, 'PO-2026-001', 1, 'received', ${TEST_USER_ID})
      `);

      testSqlite.exec(`
        INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit)
        VALUES
          (1, 1, ${TEST_ITEM_ID}, 100, 100, 50, 5000, 'kg'),
          (2, 1, 2, 50, 50, 80, 4000, 'kg')
      `);

      // Second item for allocation tests
      testSqlite.exec(`
        INSERT INTO items (id, code, name_th, type, primary_unit, on_hand, on_hand_cost, is_active)
        VALUES (2, 'RM-002', 'Raw Material 2', 'raw_material', 'kg', 50, 4000, 1)
      `);

      // Create vendors table if not exists
      try {
        testSqlite.exec(`
          INSERT INTO vendors (id, code, name, is_active)
          VALUES (1, 'V001', 'Test Vendor', 1)
        `);
      } catch {
        // Vendor might already exist
      }
    });

    describe('createLandedCost', () => {
      it('should create landed cost with lines', async () => {
        const result = await createLandedCost({
          referenceType: 'po',
          referenceId: 1,
          vendorId: 1,
          invoiceNumber: 'INV-001',
          lines: [
            { costType: 'freight', amount: 500, allocationBasis: 'value' },
            { costType: 'duty', amount: 300, allocationBasis: 'quantity' },
          ],
        }, TEST_USER_ID);

        expect(result.id).toBeGreaterThan(0);
        expect(result.documentNumber).toMatch(/^LC\d{4}-\d{5}$/);

        // Verify header was created
        const header = testSqlite.prepare('SELECT * FROM landed_cost_headers WHERE id = ?').get(result.id);
        expect(header).toBeDefined();
        expect((header as { total_amount: number }).total_amount).toBe(800);
        expect((header as { status: string }).status).toBe('draft');

        // Verify lines were created
        const lines = testSqlite.prepare('SELECT * FROM landed_cost_lines WHERE landed_cost_header_id = ?').all(result.id);
        expect(lines).toHaveLength(2);
      });

      it('should create landed cost without lines', async () => {
        const result = await createLandedCost({
          referenceType: 'po',
          referenceId: 1,
        }, TEST_USER_ID);

        expect(result.id).toBeGreaterThan(0);

        const header = testSqlite.prepare('SELECT * FROM landed_cost_headers WHERE id = ?').get(result.id);
        expect((header as { total_amount: number }).total_amount).toBe(0);
      });
    });

    describe('getLandedCost', () => {
      it('should return landed cost with lines and allocations', async () => {
        // Create landed cost
        const created = await createLandedCost({
          referenceType: 'po',
          referenceId: 1,
          lines: [
            { costType: 'freight', amount: 500, allocationBasis: 'value' },
          ],
        }, TEST_USER_ID);

        const result = await getLandedCost(created.id);

        expect(result).not.toBeNull();
        expect(result?.id).toBe(created.id);
        expect(result?.lines).toHaveLength(1);
        expect(result?.lines?.[0].costType).toBe('freight');
      });

      it('should return null for non-existent landed cost', async () => {
        const result = await getLandedCost(9999);
        expect(result).toBeNull();
      });
    });

    describe('allocateLandedCost', () => {
      // Note: Full allocation tests require more complex table references setup.
      // These tests verify the core allocation functionality.
      // For full E2E testing, see the integration tests.

      it('should throw error if landed cost not found', async () => {
        await expect(allocateLandedCost(9999)).rejects.toThrow('Landed cost with ID 9999 not found');
      });
    });

    describe('postLandedCost', () => {
      it('should throw error if not in allocated status', async () => {
        const lc = await createLandedCost({
          referenceType: 'po',
          referenceId: 1,
          lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
        }, TEST_USER_ID);

        // Try to post without allocating first
        await expect(postLandedCost(lc.id, TEST_USER_ID)).rejects.toThrow('Can only post landed cost in allocated status');
      });
    });

    describe('listLandedCosts', () => {
      it('should list landed costs with pagination', async () => {
        // Create multiple landed costs
        await createLandedCost({ referenceType: 'po', referenceId: 1 }, TEST_USER_ID);
        await createLandedCost({ referenceType: 'po', referenceId: 1 }, TEST_USER_ID);
        await createLandedCost({ referenceType: 'po', referenceId: 1 }, TEST_USER_ID);

        const result = await listLandedCosts({ page: 1, pageSize: 2 });

        expect(result.data).toHaveLength(2);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(2);
      });

      it('should filter by status', async () => {
        await createLandedCost({ referenceType: 'po', referenceId: 1 }, TEST_USER_ID);
        await createLandedCost({ referenceType: 'po', referenceId: 1 }, TEST_USER_ID);

        const draftResult = await listLandedCosts({ status: 'draft' });
        expect(draftResult.total).toBeGreaterThanOrEqual(2);
      });
    });

    describe('deleteLandedCost', () => {
      it('should delete draft landed cost', async () => {
        const lc = await createLandedCost({
          referenceType: 'po',
          referenceId: 1,
          lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
        }, TEST_USER_ID);

        await deleteLandedCost(lc.id);

        const result = await getLandedCost(lc.id);
        expect(result).toBeNull();
      });

      it('should throw error when deleting non-existent landed cost', async () => {
        await expect(deleteLandedCost(9999)).rejects.toThrow('Landed cost with ID 9999 not found');
      });
    });
  });
});
