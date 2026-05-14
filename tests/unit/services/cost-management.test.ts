/**
 * Unit Tests: Cost Management (Landed Cost + WAC)
 *
 * Covers the fixes made to:
 * 1. createLandedCost - invoiceDate string→Date conversion
 * 2. updateLandedCost - invoiceDate string→Date conversion
 * 3. allocateLandedCost - removed non-existent weight/volume fields
 * 4. postLandedCost / recalculateWAC - transactionDate string→Date conversion
 * 5. Work Center CRUD
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

// Mock the database module
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

// Import test helpers
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../helpers/test-db';
import { seedTestUser } from '../../helpers/service-test-seeds';
import { getSqliteDate, getSqliteDateOffset } from '../../helpers/service-test-utils';

// Import unit-cost schema tables
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

// Import service functions
import {
  recalculateWAC,
  getItemWAC,
  createLandedCost,
  getLandedCost,
  updateLandedCost,
  deleteLandedCost,
  allocateLandedCost,
  createWorkCenter,
  getWorkCenter,
  updateWorkCenter,
  deleteWorkCenter,
} from '@/lib/services/unit-cost.service';

describe('Cost Management Service', () => {
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

  // ── Seed helpers ──────────────────────────────────────────

  function seedCostTestData() {
    // Vendor
    sqlite.prepare(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(1, 'V-FREIGHT', 'Freight Co.', getSqliteDate(), getSqliteDate());

    // Items
    sqlite.prepare(`
      INSERT INTO items (id, code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost, current_wac, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(1, 'RM-001', 'วัตถุดิบ A', 'raw_material', 'kg', 100, 50000, 500, getSqliteDate(), getSqliteDate());

    sqlite.prepare(`
      INSERT INTO items (id, code, name_th, type, primary_unit, is_active, on_hand, on_hand_cost, current_wac, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
    `).run(2, 'RM-002', 'วัตถุดิบ B', 'raw_material', 'kg', 50, 15000, 300, getSqliteDate(), getSqliteDate());

    // Purchase Order
    sqlite.prepare(`
      INSERT INTO purchase_orders (id, po_number, vendor_id, status, total_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'PO-2026-001', 1, 'received', 65000, getSqliteDate(), getSqliteDate());

    // Purchase Order Lines
    sqlite.prepare(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, 1, 100, 100, 500, 50000, 'kg', getSqliteDate());

    sqlite.prepare(`
      INSERT INTO purchase_order_lines (id, po_id, item_id, quantity, received_quantity, unit_price, total_price, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(2, 1, 2, 50, 50, 300, 15000, 'kg', getSqliteDate());
  }

  function seedLandedCostDraft() {
    seedCostTestData();

    sqlite.prepare(`
      INSERT INTO landed_cost_headers (id, document_number, reference_type, reference_id, vendor_id, invoice_number, invoice_date, total_amount, currency, exchange_rate, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1, 'LC2026-TEST01', 'po', 1, 1, 'INV-001', '2026-03-30', 1000, 'THB', 1, 'draft', getSqliteDate(), getSqliteDate());

    sqlite.prepare(`
      INSERT INTO landed_cost_lines (id, landed_cost_header_id, cost_type, description, amount, allocation_basis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, 1, 'freight', 'Sea freight', 600, 'value', getSqliteDate());

    sqlite.prepare(`
      INSERT INTO landed_cost_lines (id, landed_cost_header_id, cost_type, description, amount, allocation_basis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(2, 1, 'duty', 'Import duty', 400, 'value', getSqliteDate());
  }

  // ── 1. WAC Calculation ────────────────────────────────────

  describe('recalculateWAC', () => {
    it('should calculate WAC correctly for receipt', async () => {
      seedCostTestData();

      // Item 1: on_hand=100, on_hand_cost=50000, WAC=500
      // Receive 50 more at 600/unit
      const result = await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 600,
        transactionDate: '2026-03-30',
        createdBy: 1,
      });

      // New: (100*500 + 50*600) / 150 = 80000/150 = 533.33
      expect(result.previousWAC).toBeCloseTo(500, 0);
      expect(result.newWAC).toBeCloseTo(533.33, 0);
      expect(result.newQty).toBe(150);
    });

    it('should create cost layer record', async () => {
      seedCostTestData();

      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 10,
        unitCost: 550,
        transactionDate: '2026-03-30',
        createdBy: 1,
      });

      const layers = sqlite.prepare('SELECT * FROM item_cost_layers WHERE item_id = 1').all() as Record<string, unknown>[];
      expect(layers.length).toBe(1);
      expect(layers[0].transaction_type).toBe('receipt');
      expect(layers[0].quantity_in).toBe(10);
      expect(layers[0].unit_cost).toBe(550);
    });

    it('should update item on_hand and current_wac', async () => {
      seedCostTestData();

      await recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: 50,
        unitCost: 600,
        transactionDate: '2026-03-30',
        createdBy: 1,
      });

      const item = sqlite.prepare('SELECT on_hand, current_wac FROM items WHERE id = 1').get() as Record<string, unknown>;
      expect(item.on_hand).toBe(150);
      expect(item.current_wac).toBeCloseTo(533.33, 0);
    });

    it('should handle landed_cost transaction type (zero quantity)', async () => {
      seedCostTestData();

      // Landed cost adds cost but no quantity
      const result = await recalculateWAC({
        itemId: 1,
        transactionType: 'landed_cost',
        transactionId: 1,
        quantity: 0,
        unitCost: 1000, // Total landed cost
        transactionDate: '2026-03-30',
        notes: 'Freight allocation',
        createdBy: 1,
      });

      // Quantity unchanged, cost increased
      expect(result.newQty).toBe(100);
    });

    it('should reject transaction that causes negative inventory', async () => {
      seedCostTestData();

      await expect(recalculateWAC({
        itemId: 1,
        transactionType: 'receipt',
        transactionId: 1,
        quantity: -200, // More than on_hand (100)
        unitCost: 500,
        transactionDate: '2026-03-30',
        createdBy: 1,
      })).rejects.toThrow(/negative inventory/);
    });
  });

  describe('getItemWAC', () => {
    it('should return current WAC', async () => {
      seedCostTestData();

      const wac = await getItemWAC(1);
      expect(wac).toBe(500);
    });

    it('should return null for non-existent item', async () => {
      const wac = await getItemWAC(9999);
      expect(wac).toBeNull();
    });
  });

  // ── 2. Landed Cost CRUD ───────────────────────────────────

  describe('createLandedCost', () => {
    it('should create with correct fields', async () => {
      seedCostTestData();

      const result = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        vendorId: 1,
        invoiceNumber: 'INV-TEST',
        invoiceDate: '2026-03-30',
        currency: 'THB',
        exchangeRate: 1,
        lines: [
          { costType: 'freight', description: 'Ocean freight', amount: 500, allocationBasis: 'value' },
        ],
      }, 1);

      expect(result.id).toBeGreaterThan(0);
      expect(result.documentNumber).toMatch(/^LC/);
    });

    it('should handle invoiceDate as string (MySQL fix)', async () => {
      seedCostTestData();

      const result = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        invoiceDate: '2026-03-30', // String date - previously crashed on MySQL
        currency: 'THB',
        exchangeRate: 1,
        lines: [{ costType: 'freight', amount: 100, allocationBasis: 'value' }],
      }, 1);

      const header = sqlite.prepare('SELECT * FROM landed_cost_headers WHERE id = ?').get(result.id) as Record<string, unknown>;
      expect(header).toBeDefined();
      expect(header.status).toBe('draft');
    });

    it('should calculate total from lines', async () => {
      seedCostTestData();

      const result = await createLandedCost({
        referenceType: 'po',
        referenceId: 1,
        currency: 'THB',
        exchangeRate: 1,
        lines: [
          { costType: 'freight', amount: 300, allocationBasis: 'value' },
          { costType: 'duty', amount: 200, allocationBasis: 'value' },
          { costType: 'insurance', amount: 100, allocationBasis: 'value' },
        ],
      }, 1);

      const header = sqlite.prepare('SELECT total_amount FROM landed_cost_headers WHERE id = ?').get(result.id) as Record<string, unknown>;
      expect(header.total_amount).toBe(600);
    });
  });

  describe('updateLandedCost', () => {
    it('should update draft landed cost', async () => {
      seedLandedCostDraft();

      await updateLandedCost(1, {
        invoiceNumber: 'INV-UPDATED',
        invoiceDate: '2026-04-01',
        currency: 'USD',
        exchangeRate: 35.5,
      });

      const header = sqlite.prepare('SELECT * FROM landed_cost_headers WHERE id = 1').get() as Record<string, unknown>;
      expect(header.invoice_number).toBe('INV-UPDATED');
      expect(header.currency).toBe('USD');
      expect(header.exchange_rate).toBe(35.5);
    });

    it('should replace lines when provided', async () => {
      seedLandedCostDraft();

      await updateLandedCost(1, {
        lines: [
          { costType: 'handling', description: 'Port handling', amount: 250, allocationBasis: 'quantity' },
        ],
      });

      const lines = sqlite.prepare('SELECT * FROM landed_cost_lines WHERE landed_cost_header_id = 1').all() as Record<string, unknown>[];
      expect(lines.length).toBe(1); // Replaced 2 old lines with 1 new
      expect(lines[0].cost_type).toBe('handling');
      expect(lines[0].amount).toBe(250);
    });

    it('should reject update on non-draft', async () => {
      seedLandedCostDraft();
      sqlite.prepare('UPDATE landed_cost_headers SET status = ? WHERE id = 1').run('allocated');

      await expect(updateLandedCost(1, { invoiceNumber: 'X' })).rejects.toThrow(/not in draft/);
    });
  });

  describe('deleteLandedCost', () => {
    it('should delete draft with lines', async () => {
      seedLandedCostDraft();

      await deleteLandedCost(1);

      const header = sqlite.prepare('SELECT * FROM landed_cost_headers WHERE id = 1').get();
      expect(header).toBeUndefined();
      const lines = sqlite.prepare('SELECT * FROM landed_cost_lines WHERE landed_cost_header_id = 1').all();
      expect(lines.length).toBe(0);
    });

    it('should reject delete on non-draft', async () => {
      seedLandedCostDraft();
      sqlite.prepare('UPDATE landed_cost_headers SET status = ? WHERE id = 1').run('posted');

      await expect(deleteLandedCost(1)).rejects.toThrow(/not in draft/);
    });
  });

  // ── 3. Landed Cost Allocation ─────────────────────────────

  describe('allocateLandedCost', () => {
    it('should allocate by value proportionally', async () => {
      seedLandedCostDraft();

      const allocations = await allocateLandedCost(1);

      // Total cost: 1000 (600 freight + 400 duty)
      // PO Line 1: 100 * 500 = 50000 value (76.92%)
      // PO Line 2: 50 * 300 = 15000 value (23.08%)
      expect(allocations.length).toBeGreaterThan(0);

      // Check allocations sum to total
      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBeCloseTo(1000, 0);
    });

    it('should update status to allocated', async () => {
      seedLandedCostDraft();

      await allocateLandedCost(1);

      const header = sqlite.prepare('SELECT status FROM landed_cost_headers WHERE id = 1').get() as Record<string, unknown>;
      expect(header.status).toBe('allocated');
    });

    it('should create allocation records in DB', async () => {
      seedLandedCostDraft();

      await allocateLandedCost(1);

      const allocations = sqlite.prepare('SELECT * FROM landed_cost_allocations WHERE landed_cost_header_id = 1').all() as Record<string, unknown>[];
      expect(allocations.length).toBeGreaterThan(0);
      for (const alloc of allocations) {
        expect(alloc.item_id).toBeDefined();
        expect(Number(alloc.allocated_amount)).toBeGreaterThan(0);
        expect(Number(alloc.basis_value)).toBeGreaterThan(0);
      }
    });

    it('should reject allocation on non-draft', async () => {
      seedLandedCostDraft();
      sqlite.prepare('UPDATE landed_cost_headers SET status = ? WHERE id = 1').run('posted');

      await expect(allocateLandedCost(1)).rejects.toThrow(/draft status/);
    });

    it('should reject when no lines exist', async () => {
      seedCostTestData();
      sqlite.prepare(`
        INSERT INTO landed_cost_headers (id, document_number, reference_type, reference_id, total_amount, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(1, 'LC-EMPTY', 'po', 1, 0, 'draft', getSqliteDate(), getSqliteDate());

      await expect(allocateLandedCost(1)).rejects.toThrow(/No cost lines/);
    });
  });

  // ── 4. Work Center CRUD ───────────────────────────────────

  describe('Work Center CRUD', () => {
    it('should create work center', async () => {
      const result = await createWorkCenter({
        code: 'WC-MIX-01',
        name: 'Mixing Station 1',
        laborRatePerHour: 150,
        overheadRatePerHour: 75,
        machineRatePerHour: 200,
        capacityHoursPerDay: 8,
        isActive: true,
      });

      expect(result.id).toBeGreaterThan(0);
      expect(result.code).toBe('WC-MIX-01');
    });

    it('should get work center by id', async () => {
      const created = await createWorkCenter({
        code: 'WC-FILL',
        name: 'Filling Line',
        laborRatePerHour: 120,
        overheadRatePerHour: 60,
        machineRatePerHour: 180,
      });

      const wc = await getWorkCenter(created.id);
      expect(wc).toBeDefined();
      expect(wc!.code).toBe('WC-FILL');
      expect(wc!.name).toBe('Filling Line');
      expect(Number(wc!.laborRatePerHour)).toBe(120);
    });

    it('should update work center', async () => {
      const created = await createWorkCenter({
        code: 'WC-UPD',
        name: 'Old Name',
        laborRatePerHour: 100,
        overheadRatePerHour: 50,
      });

      await updateWorkCenter(created.id, {
        name: 'New Name',
        laborRatePerHour: 200,
      });

      const wc = await getWorkCenter(created.id);
      expect(wc!.name).toBe('New Name');
      expect(Number(wc!.laborRatePerHour)).toBe(200);
    });

    it('should delete work center', async () => {
      const created = await createWorkCenter({
        code: 'WC-DEL',
        name: 'To Delete',
        laborRatePerHour: 100,
        overheadRatePerHour: 50,
      });

      await deleteWorkCenter(created.id);

      const wc = await getWorkCenter(created.id);
      expect(wc).toBeNull();
    });

    it('should reject duplicate code', async () => {
      await createWorkCenter({
        code: 'WC-DUP',
        name: 'First',
        laborRatePerHour: 100,
        overheadRatePerHour: 50,
      });

      await expect(createWorkCenter({
        code: 'WC-DUP',
        name: 'Second',
        laborRatePerHour: 100,
        overheadRatePerHour: 50,
      })).rejects.toThrow();
    });
  });

  // ── 5. getLandedCost (with lines) ─────────────────────────

  describe('getLandedCost', () => {
    it('should return header with lines', async () => {
      seedLandedCostDraft();

      const lc = await getLandedCost(1);

      expect(lc).toBeDefined();
      expect(lc!.documentNumber).toBe('LC2026-TEST01');
      expect(lc!.status).toBe('draft');
      expect(lc!.lines).toBeDefined();
      expect(lc!.lines.length).toBe(2);
      expect(lc!.lines[0].costType).toBe('freight');
      expect(lc!.lines[1].costType).toBe('duty');
    });

    it('should return null for non-existent', async () => {
      const lc = await getLandedCost(9999);
      expect(lc).toBeNull();
    });
  });
});
