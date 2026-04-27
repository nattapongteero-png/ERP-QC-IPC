/**
 * Integration Tests: Cost Management End-to-End
 *
 * Tests the complete landed cost lifecycle:
 * Create → Add Lines → Allocate → Post → WAC Updated
 * Also tests WAC calculation with multiple transactions
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

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import { seedTestUser } from '../../helpers/service-test-seeds';
import { getSqliteDate } from '../../helpers/service-test-utils';

import {
  sqliteWorkCenters,
  sqliteItemCostLayers,
  sqliteLandedCostHeaders,
  sqliteLandedCostLines,
  sqliteLandedCostAllocations,
  sqliteWorkOrderOperations,
  sqliteWorkOrderCosts,
  sqliteOverheadRates,
} from '@/lib/db/schema-unit-cost';

import {
  recalculateWAC,
  getItemWAC,
  createLandedCost,
  getLandedCost,
  updateLandedCost,
  allocateLandedCost,
  postLandedCost,
} from '@/lib/services/unit-cost.service';

describe('Cost Management Integration', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteItems,
      schema.sqliteVendors,
      schema.sqliteWarehouses,
      schema.sqliteInventoryLots,
      schema.sqliteInventoryTransactions,
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteHROrgUnits,
      schema.sqliteHREmployees,
      schema.sqliteGLAccounts,
      schema.sqliteGLAccountTypes,
      schema.sqliteWorkOrders,
      schema.sqliteWorkOrderMaterials,
      schema.sqliteOperations,
      schema.sqliteBOM,
      schema.sqliteBOMLines,
      sqliteWorkCenters,
      sqliteItemCostLayers,
      sqliteLandedCostHeaders,
      sqliteLandedCostLines,
      sqliteLandedCostAllocations,
      sqliteWorkOrderOperations,
      sqliteWorkOrderCosts,
      sqliteOverheadRates,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    cleanTables(sqlite, [
      'landed_cost_allocations',
      'landed_cost_lines',
      'landed_cost_headers',
      'item_cost_layers',
      'work_order_costs',
      'work_order_operations',
      'overhead_rates',
      'work_centers',
      'work_order_materials',
      'work_orders',
      'purchase_order_lines',
      'purchase_orders',
      'inventory_transactions',
      'inventory_lots',
      'bom_lines',
      'bom',
      'operations',
      'items',
      'vendors',
      'warehouses',
      'hr_employees',
      'hr_org_units',
      'audit_trail',
      'users',
    ]);
    seedTestUser(sqlite);
  });

  function seedFullCostData() {
    // Vendor
    sqlite.prepare(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(1, 'V-SUPPLIER', 'Thai Herb Supplier', getSqliteDate(), getSqliteDate());

    // Items with initial stock
    const items = [
      [1, 'RM-TURMERIC', 'ขมิ้นชัน', 'raw_material', 'kg', 200, 100000, 500],
      [2, 'RM-PEPPER', 'พริกไทยดำ', 'raw_material', 'kg', 100, 80000, 800],
      [3, 'PKG-BOTTLE', 'ขวดแก้ว', 'packaging', 'pcs', 1000, 15000, 15],
    ];
    const itemStmt = sqlite.prepare(`
      INSERT INTO items (id, code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost, current_wac, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      itemStmt.run(...item, getSqliteDate(), getSqliteDate());
    }

    // Purchase Order (received)
    sqlite.prepare(`
      INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'PO-2026-100', 1, 'received', 195000, getSqliteDate(), getSqliteDate());

    // PO Lines
    sqlite.prepare(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, 1, 200, 200, 500, 100000, 'kg', getSqliteDate());

    sqlite.prepare(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2, 1, 2, 100, 100, 800, 80000, 'kg', getSqliteDate());

    sqlite.prepare(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(3, 1, 3, 1000, 1000, 15, 15000, 'pcs', getSqliteDate());
  }

  // ── End-to-End: Landed Cost Lifecycle ─────────────────────

  describe('Landed Cost Full Lifecycle', () => {
    it('should complete Create → Allocate → Post flow', async () => {
      seedFullCostData();

      // ── Step 1: Create Landed Cost ──
      const created = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        vendorId: 1,
        invoiceNumber: 'FRT-2026-001',
        invoiceDate: '2026-03-30',
        currency: 'THB',
        exchangeRate: 1,
        lines: [
          { costType: 'freight', description: 'Sea freight from China', amount: 5000, allocationBasis: 'value' },
          { costType: 'duty', description: 'Import duty 5%', amount: 9750, allocationBasis: 'value' },
          { costType: 'insurance', description: 'Marine insurance', amount: 1000, allocationBasis: 'value' },
        ],
      }, 1);

      expect(created.id).toBeGreaterThan(0);
      expect(created.documentNumber).toMatch(/^LC/);

      // Verify header
      const lc = await getLandedCost(created.id);
      expect(lc).toBeDefined();
      expect(lc!.status).toBe('draft');
      expect(lc!.lines.length).toBe(3);
      expect(Number(lc!.totalAmount)).toBe(15750);

      // ── Step 2: Update (fix invoice number) ──
      await updateLandedCost(created.id, {
        invoiceNumber: 'FRT-2026-001-REV',
      });

      const updated = await getLandedCost(created.id);
      expect(updated!.invoiceNumber).toBe('FRT-2026-001-REV');

      // ── Step 3: Allocate ──
      const allocations = await allocateLandedCost(created.id);

      expect(allocations.length).toBeGreaterThan(0);

      // Total allocated should equal total cost
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBeCloseTo(15750, 0);

      // Check proportional allocation by value
      // PO values: RM-TURMERIC=100000, RM-PEPPER=80000, PKG-BOTTLE=15000 = 195000 total
      // RM-TURMERIC share = 100000/195000 = 51.28%
      const turmericAllocs = allocations.filter(a => a.itemId === 1);
      const turmericTotal = turmericAllocs.reduce((sum, a) => sum + a.allocatedAmount, 0);
      const expectedTurmericShare = 15750 * (100000 / 195000);
      expect(turmericTotal).toBeCloseTo(expectedTurmericShare, 0);

      // Status should be allocated
      const afterAlloc = await getLandedCost(created.id);
      expect(afterAlloc!.status).toBe('allocated');

      // ── Step 4: Record WAC before post ──
      const wacBefore = await getItemWAC(1);
      expect(wacBefore).toBe(500); // Original WAC

      // ── Step 5: Post ──
      await postLandedCost(created.id, 1);

      const posted = await getLandedCost(created.id);
      expect(posted!.status).toBe('posted');

      // ── Step 6: Verify WAC updated ──
      // Cost layers should exist for each allocated item
      const layers = sqlite.prepare('SELECT * FROM item_cost_layers ORDER BY item_id').all() as Record<string, unknown>[];
      expect(layers.length).toBeGreaterThan(0);

      // Each layer should have landed_cost transaction type
      for (const layer of layers) {
        expect(layer.transaction_type).toBe('landed_cost');
      }
    });
  });

  // ── WAC Multi-Transaction ─────────────────────────────────

  describe('WAC with Multiple Transactions', () => {
    it('should track running WAC across receipts', async () => {
      seedFullCostData();

      // Initial: on_hand=200, cost=100000, WAC=500
      const wac1 = await getItemWAC(1);
      expect(wac1).toBe(500);

      // Receipt 1: 100kg at 600/kg
      const r1 = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 100,
        quantity: 100,
        unitCost: 600,
        transactionDate: '2026-03-25',
        createdBy: 1,
      });
      // (200*500 + 100*600) / 300 = 160000/300 = 533.33
      expect(r1.newWAC).toBeCloseTo(533.33, 0);
      expect(r1.newQty).toBe(300);

      // Receipt 2: 50kg at 450/kg
      const r2 = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 101,
        quantity: 50,
        unitCost: 450,
        transactionDate: '2026-03-26',
        createdBy: 1,
      });
      // (300*533.33 + 50*450) / 350 = 182500/350 = 521.43
      expect(r2.newQty).toBe(350);
      expect(r2.newWAC).toBeCloseTo(521.43, 0);

      // Verify cost layers
      const layers = sqlite.prepare('SELECT * FROM item_cost_layers WHERE item_id = 1 ORDER BY id').all() as Record<string, unknown>[];
      expect(layers.length).toBe(2);
      expect(layers[0].transaction_type).toBe('receipt');
      expect(layers[1].transaction_type).toBe('receipt');
      expect(layers[1].running_qty).toBe(350);
    });
  });

  // ── Allocation by Different Bases ─────────────────────────

  describe('Allocation Basis Types', () => {
    it('should allocate by quantity', async () => {
      seedFullCostData();

      const created = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        currency: 'THB',
        exchangeRate: 1,
        lines: [
          { costType: 'handling', description: 'Port handling', amount: 1300, allocationBasis: 'quantity' },
        ],
      }, 1);

      const allocations = await allocateLandedCost(created.id);

      // By quantity: RM-TURMERIC=200, RM-PEPPER=100, PKG-BOTTLE=1000 = 1300 total
      // RM-TURMERIC share = 200/1300 * 1300 = 200
      // PKG-BOTTLE share = 1000/1300 * 1300 = 1000
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBeCloseTo(1300, 0);

      const bottleAllocs = allocations.filter(a => a.itemId === 3);
      const bottleTotal = bottleAllocs.reduce((sum, a) => sum + a.allocatedAmount, 0);
      // Bottle gets largest share by quantity (1000/1300)
      expect(bottleTotal).toBeCloseTo(1300 * (1000 / 1300), 0);
    });
  });

  // ── Error Scenarios ───────────────────────────────────────

  describe('Error Handling', () => {
    it('should prevent posting unallocated landed cost', async () => {
      seedFullCostData();

      const created = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        currency: 'THB',
        exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
      }, 1);

      // Try to post without allocating first
      await expect(postLandedCost(created.id, 1)).rejects.toThrow(/allocated status/);
    });

    it('should prevent double allocation', async () => {
      seedFullCostData();

      const created = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        currency: 'THB',
        exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 500, allocationBasis: 'value' }],
      }, 1);

      await allocateLandedCost(created.id);

      // Try to allocate again (already in 'allocated' status)
      await expect(allocateLandedCost(created.id)).rejects.toThrow(/draft status/);
    });

    it('should prevent WAC negative inventory', async () => {
      seedFullCostData();

      // Item 1 has 200kg on hand, try to issue 250kg
      await expect(recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 999,
        quantity: -250,
        unitCost: 500,
        transactionDate: '2026-03-30',
        createdBy: 1,
      })).rejects.toThrow(/negative inventory/);
    });
  });
});
