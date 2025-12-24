/**
 * Purchasing Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8 - การรับมอบ/การเก็บรักษา)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete purchasing module functionality with real-world scenarios.
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
    db: () => testDb,
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
  checkVendorApproval,
  getPreferredVendor,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrder,
  generateVMISnapshot,
  processVMIASN,
  evaluateVendorPerformance,
  addToAVL,
} from '@/lib/services/purchasing.service';

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
const FUTURE_EXPIRY = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Test data IDs
let testVendorId: number;
let testVendor2Id: number;
let testVMIVendorId: number;
let testItemId: number;
let testItem2Id: number;
let testWarehouseId: number;

describe('Purchasing Service Real Integration Tests', () => {
  beforeAll(() => {
    console.log('Setting up test environment...');
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
      schema.sqlitePurchaseOrders,
      schema.sqlitePurchaseOrderLines,
      schema.sqliteApprovedVendorList,
    ];

    for (const table of tables) {
      const sql = generateCreateTableSql(table);
      sqlite.exec(sql);
    }

    // Create test user
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active, created_at)
      VALUES (1, 'test@test.com', 'hash', 'Test User', 'purchasing', 1, '${TODAY}')
    `);

    // Create test warehouse
    const whResult = sqlite.prepare(`
      INSERT INTO warehouses (code, name, type, is_active, created_at)
      VALUES ('WH-RM', 'Raw Material Warehouse', 'raw_material', 1, '${TODAY}')
    `).run();
    testWarehouseId = Number(whResult.lastInsertRowid);

    // Create test items (raw materials)
    const item1Result = sqlite.prepare(`
      INSERT INTO items (code, name_th, name_en, type, category, primary_unit, min_stock, max_stock, reorder_point, created_at)
      VALUES ('RM-001', 'สารสกัดสมุนไพร A', 'Herbal Extract A', 'raw_material', 'herbal_extract', 'kg', 100, 500, 150, '${TODAY}')
    `).run();
    testItemId = Number(item1Result.lastInsertRowid);

    const item2Result = sqlite.prepare(`
      INSERT INTO items (code, name_th, name_en, type, category, primary_unit, min_stock, max_stock, reorder_point, created_at)
      VALUES ('RM-002', 'สารสกัดสมุนไพร B', 'Herbal Extract B', 'raw_material', 'herbal_extract', 'kg', 50, 200, 75, '${TODAY}')
    `).run();
    testItem2Id = Number(item2Result.lastInsertRowid);

    // Create test vendors
    const vendor1Result = sqlite.prepare(`
      INSERT INTO vendors (code, name, is_active, is_approved, is_vmi, lead_time_days, created_at)
      VALUES ('VND-001', 'Approved Vendor Co.', 1, 1, 0, 7, '${TODAY}')
    `).run();
    testVendorId = Number(vendor1Result.lastInsertRowid);

    const vendor2Result = sqlite.prepare(`
      INSERT INTO vendors (code, name, is_active, is_approved, is_vmi, lead_time_days, created_at)
      VALUES ('VND-002', 'Not Approved Vendor', 1, 0, 0, 14, '${TODAY}')
    `).run();
    testVendor2Id = Number(vendor2Result.lastInsertRowid);

    const vendor3Result = sqlite.prepare(`
      INSERT INTO vendors (code, name, is_active, is_approved, is_vmi, lead_time_days, created_at)
      VALUES ('VND-VMI', 'VMI Partner Ltd.', 1, 1, 1, 3, '${TODAY}')
    `).run();
    testVMIVendorId = Number(vendor3Result.lastInsertRowid);

    // Add items to AVL (Approved Vendor List)
    sqlite.prepare(`
      INSERT INTO approved_vendor_list (vendor_id, item_id, is_preferred, approval_date, expiry_date)
      VALUES (?, ?, 1, '${TODAY}', '${FUTURE_DATE}')
    `).run(testVendorId, testItemId);

    sqlite.prepare(`
      INSERT INTO approved_vendor_list (vendor_id, item_id, is_preferred, approval_date, expiry_date)
      VALUES (?, ?, 0, '${TODAY}', '${FUTURE_DATE}')
    `).run(testVendorId, testItem2Id);

    // Add items to VMI vendor AVL
    sqlite.prepare(`
      INSERT INTO approved_vendor_list (vendor_id, item_id, is_preferred, approval_date)
      VALUES (?, ?, 1, '${TODAY}')
    `).run(testVMIVendorId, testItemId);

    sqlite.prepare(`
      INSERT INTO approved_vendor_list (vendor_id, item_id, is_preferred, approval_date)
      VALUES (?, ?, 1, '${TODAY}')
    `).run(testVMIVendorId, testItem2Id);
  });

  afterAll(() => {
    console.log('Cleaning up test environment...');
    sqlite.close();
  });

  beforeEach(() => {
    // Clean up transactional tables before each test
    sqlite.exec('DELETE FROM inventory_transactions');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM purchase_order_lines');
    sqlite.exec('DELETE FROM purchase_orders');
  });

  // ============================================
  // Vendor Approval (AVL) Tests
  // ============================================

  describe('checkVendorApproval', () => {
    it('should return approved for valid vendor-item combination', async () => {
      const result = await checkVendorApproval(testVendorId, testItemId);

      expect(result.approved).toBe(true);
      expect(result.message).toBe('Approved');
      expect(result.isPreferred).toBe(true);
    });

    it('should return not approved for non-approved vendor', async () => {
      const result = await checkVendorApproval(testVendor2Id, testItemId);

      expect(result.approved).toBe(false);
      expect(result.message).toBe('Vendor is not approved');
    });

    it('should return not approved for item not in AVL', async () => {
      // Create new item not in AVL
      const newItemResult = sqlite.prepare(`
        INSERT INTO items (code, name_th, type, category, primary_unit, created_at)
        VALUES ('RM-NEW', 'New Material', 'raw_material', 'other', 'kg', '${TODAY}')
      `).run();
      const newItemId = Number(newItemResult.lastInsertRowid);

      const result = await checkVendorApproval(testVendorId, newItemId);

      expect(result.approved).toBe(false);
      expect(result.message).toBe('Vendor not approved for this item');
    });

    it('should return not approved for non-existent vendor', async () => {
      const result = await checkVendorApproval(99999, testItemId);

      expect(result.approved).toBe(false);
      expect(result.message).toBe('Vendor not found');
    });

    it('should return is_preferred flag correctly', async () => {
      const preferredResult = await checkVendorApproval(testVendorId, testItemId);
      expect(preferredResult.isPreferred).toBe(true);

      const nonPreferredResult = await checkVendorApproval(testVendorId, testItem2Id);
      expect(nonPreferredResult.isPreferred).toBe(false);
    });
  });

  describe('getPreferredVendor', () => {
    it('should return preferred vendor for item', async () => {
      const vendorId = await getPreferredVendor(testItemId);

      expect(vendorId).toBe(testVendorId);
    });

    it('should return any approved vendor if no preferred', async () => {
      // For item2, testVendorId is not preferred but still approved
      const vendorId = await getPreferredVendor(testItem2Id);

      expect(vendorId).not.toBeNull();
    });

    it('should return null if no approved vendor exists', async () => {
      // Create item with no AVL entries
      const isolatedItemResult = sqlite.prepare(`
        INSERT INTO items (code, name_th, type, category, primary_unit, created_at)
        VALUES ('RM-ISOLATED', 'Isolated Material', 'raw_material', 'other', 'kg', '${TODAY}')
      `).run();

      const vendorId = await getPreferredVendor(Number(isolatedItemResult.lastInsertRowid));

      expect(vendorId).toBeNull();
    });
  });

  // ============================================
  // Purchase Order CRUD Tests
  // ============================================

  describe('createPurchaseOrder', () => {
    it('should create PO with valid vendor and items', async () => {
      const lines = [
        { itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE },
        { itemId: testItem2Id, quantity: 50, unitPrice: 750, requiredDate: FUTURE_DATE },
      ];

      const poId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);

      expect(poId).toBeGreaterThan(0);

      // Verify PO was created
      const po = sqlite.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.vendor_id).toBe(testVendorId);
      expect(po.status).toBe('draft');
      expect(po.total_amount).toBe(100 * 500 + 50 * 750); // 87500

      // Verify lines were created
      const poLines = sqlite.prepare('SELECT * FROM purchase_order_lines WHERE po_id = ?').all(poId);
      expect(poLines.length).toBe(2);
    });

    it('should generate sequential PO numbers', async () => {
      const lines = [{ itemId: testItemId, quantity: 10, unitPrice: 100, requiredDate: FUTURE_DATE }];

      const poId1 = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);
      const poId2 = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);

      const po1 = sqlite.prepare('SELECT po_number FROM purchase_orders WHERE id = ?').get(poId1) as any;
      const po2 = sqlite.prepare('SELECT po_number FROM purchase_orders WHERE id = ?').get(poId2) as any;

      // Extract sequence numbers
      const seq1 = parseInt(po1.po_number.split('-').pop());
      const seq2 = parseInt(po2.po_number.split('-').pop());

      expect(seq2).toBe(seq1 + 1);
    });

    it('should reject PO for non-approved vendor-item combination', async () => {
      const lines = [
        { itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE },
      ];

      await expect(
        createPurchaseOrder(testVendor2Id, lines, TEST_USER_ID)
      ).rejects.toThrow('Vendor not approved');
    });
  });

  // ============================================
  // Purchase Order Status Workflow Tests
  // ============================================

  describe('updatePurchaseOrderStatus', () => {
    let testPoId: number;

    beforeEach(async () => {
      const lines = [{ itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE }];
      testPoId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);
    });

    it('should allow valid status transitions', async () => {
      // draft -> pending_approval
      await updatePurchaseOrderStatus(testPoId, 'pending_approval', TEST_USER_ID);
      let po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('pending_approval');

      // pending_approval -> approved
      await updatePurchaseOrderStatus(testPoId, 'approved', TEST_USER_ID);
      po = sqlite.prepare('SELECT status, approved_by FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('approved');
      expect(po.approved_by).toBe(TEST_USER_ID);

      // approved -> sent
      await updatePurchaseOrderStatus(testPoId, 'sent', TEST_USER_ID);
      po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('sent');
    });

    it('should reject invalid status transitions', async () => {
      // draft -> received is not allowed
      await expect(
        updatePurchaseOrderStatus(testPoId, 'received', TEST_USER_ID)
      ).rejects.toThrow('Cannot transition from draft to received');
    });

    it('should allow cancellation from most statuses', async () => {
      await updatePurchaseOrderStatus(testPoId, 'cancelled', TEST_USER_ID);

      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('cancelled');
    });

    it('should not allow transitions from closed status', async () => {
      // Move to closed first
      await updatePurchaseOrderStatus(testPoId, 'pending_approval', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'approved', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'sent', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'received', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'closed', TEST_USER_ID);

      await expect(
        updatePurchaseOrderStatus(testPoId, 'draft', TEST_USER_ID)
      ).rejects.toThrow('Cannot transition from closed');
    });
  });

  // ============================================
  // Goods Receipt Tests
  // ============================================

  describe('receivePurchaseOrder', () => {
    let testPoId: number;
    let testLineId: number;

    beforeEach(async () => {
      const lines = [{ itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE }];
      testPoId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);

      // Move PO to sent status
      await updatePurchaseOrderStatus(testPoId, 'pending_approval', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'approved', TEST_USER_ID);
      await updatePurchaseOrderStatus(testPoId, 'sent', TEST_USER_ID);

      // Get line ID
      const poLine = sqlite.prepare('SELECT id FROM purchase_order_lines WHERE po_id = ?').get(testPoId) as any;
      testLineId = poLine.id;
    });

    it('should receive full quantity and update status to received', async () => {
      const receivedLines = [
        { lineId: testLineId, receivedQuantity: 100, lotNumber: 'LOT-001', expiryDate: FUTURE_EXPIRY },
      ];

      const lotIds = await receivePurchaseOrder(testPoId, receivedLines, testWarehouseId, TEST_USER_ID);

      expect(lotIds.length).toBe(1);

      // Verify PO status
      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('received');

      // Verify lot was created in quarantine
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotIds[0]) as any;
      expect(lot.status).toBe('quarantine');
      expect(lot.quantity).toBe(100);
      expect(lot.lot_number).toBe('LOT-001');
    });

    it('should handle partial receipt', async () => {
      const receivedLines = [
        { lineId: testLineId, receivedQuantity: 50, lotNumber: 'LOT-001', expiryDate: FUTURE_EXPIRY },
      ];

      const lotIds = await receivePurchaseOrder(testPoId, receivedLines, testWarehouseId, TEST_USER_ID);

      expect(lotIds.length).toBe(1);

      // Verify PO status is partial_receipt
      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(testPoId) as any;
      expect(po.status).toBe('partial_receipt');

      // Verify line received quantity
      const line = sqlite.prepare('SELECT received_quantity FROM purchase_order_lines WHERE id = ?').get(testLineId) as any;
      expect(line.received_quantity).toBe(50);
    });

    it('should reject receipt for non-sent PO', async () => {
      // Create new PO in draft status
      const lines = [{ itemId: testItemId, quantity: 50, unitPrice: 100, requiredDate: FUTURE_DATE }];
      const draftPoId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);
      const draftLineId = (sqlite.prepare('SELECT id FROM purchase_order_lines WHERE po_id = ?').get(draftPoId) as any).id;

      const receivedLines = [
        { lineId: draftLineId, receivedQuantity: 50, lotNumber: 'LOT-002' },
      ];

      await expect(
        receivePurchaseOrder(draftPoId, receivedLines, testWarehouseId, TEST_USER_ID)
      ).rejects.toThrow('must be Sent or Partial Receipt');
    });
  });

  // ============================================
  // VMI Integration Tests
  // ============================================

  describe('generateVMISnapshot', () => {
    beforeEach(() => {
      // Create some inventory lots for VMI items
      sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, reserved_quantity, unit, status, vendor_id, created_at)
        VALUES ('VMI-LOT-001', ?, ?, 200, 50, 'kg', 'released', ?, '${TODAY}')
      `).run(testItemId, testWarehouseId, testVMIVendorId);

      sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, reserved_quantity, unit, status, vendor_id, created_at)
        VALUES ('VMI-LOT-002', ?, ?, 100, 0, 'kg', 'quarantine', ?, '${TODAY}')
      `).run(testItemId, testWarehouseId, testVMIVendorId);
    });

    it('should generate VMI snapshot for VMI vendor', async () => {
      const snapshot = await generateVMISnapshot(testVMIVendorId);

      expect(snapshot.vendorId).toBe(testVMIVendorId);
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.items.length).toBeGreaterThan(0);

      // Find item in snapshot
      const item = snapshot.items.find(i => i.itemCode === 'RM-001');
      expect(item).toBeDefined();
      expect(item?.onHand).toBe(200);
      expect(item?.available).toBe(150); // 200 - 50 reserved
      expect(item?.quarantine).toBe(100);
    });

    it('should throw error for non-VMI vendor', async () => {
      await expect(generateVMISnapshot(testVendorId)).rejects.toThrow('not a VMI vendor');
    });
  });

  describe('processVMIASN', () => {
    it('should create PO from ASN and auto-approve', async () => {
      const asn = {
        asnNumber: 'ASN-2024-001',
        vendorId: testVMIVendorId,
        expectedDeliveryDate: FUTURE_DATE,
        lines: [
          { itemCode: 'RM-001', quantity: 100, lotNumber: 'VMI-NEW-001' },
          { itemCode: 'RM-002', quantity: 50, lotNumber: 'VMI-NEW-002' },
        ],
      };

      const result = await processVMIASN(asn, TEST_USER_ID);

      expect(result.poId).toBeGreaterThan(0);

      // Verify PO is in sent status (auto-approved)
      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(result.poId) as any;
      expect(po.status).toBe('sent');
    });

    it('should reject ASN from non-VMI vendor', async () => {
      const asn = {
        asnNumber: 'ASN-2024-002',
        vendorId: testVendorId, // Not a VMI vendor
        expectedDeliveryDate: FUTURE_DATE,
        lines: [{ itemCode: 'RM-001', quantity: 100, lotNumber: 'LOT-001' }],
      };

      await expect(processVMIASN(asn, TEST_USER_ID)).rejects.toThrow('not a VMI vendor');
    });
  });

  // ============================================
  // Vendor Evaluation Tests
  // ============================================

  describe('evaluateVendorPerformance', () => {
    beforeEach(async () => {
      // Create some completed POs for vendor evaluation
      const lines = [{ itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE }];

      for (let i = 0; i < 3; i++) {
        const poId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);
        await updatePurchaseOrderStatus(poId, 'pending_approval', TEST_USER_ID);
        await updatePurchaseOrderStatus(poId, 'approved', TEST_USER_ID);
        await updatePurchaseOrderStatus(poId, 'sent', TEST_USER_ID);
        await updatePurchaseOrderStatus(poId, 'received', TEST_USER_ID);
        await updatePurchaseOrderStatus(poId, 'closed', TEST_USER_ID);
      }

      // Create inventory lots for quality metrics
      sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, status, vendor_id, created_at)
        VALUES ('EVAL-LOT-001', ?, ?, 100, 'kg', 'released', ?, '${TODAY}')
      `).run(testItemId, testWarehouseId, testVendorId);

      sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, status, vendor_id, created_at)
        VALUES ('EVAL-LOT-002', ?, ?, 100, 'kg', 'released', ?, '${TODAY}')
      `).run(testItemId, testWarehouseId, testVendorId);

      sqlite.prepare(`
        INSERT INTO inventory_lots (lot_number, item_id, warehouse_id, quantity, unit, status, vendor_id, created_at)
        VALUES ('EVAL-LOT-003', ?, ?, 100, 'kg', 'rejected', ?, '${TODAY}')
      `).run(testItemId, testWarehouseId, testVendorId);
    });

    it('should calculate vendor performance metrics', async () => {
      const evaluation = await evaluateVendorPerformance(testVendorId);

      expect(evaluation.vendorId).toBe(testVendorId);
      expect(evaluation.vendorName).toBe('Approved Vendor Co.');
      expect(evaluation.totalOrders).toBe(3);
      expect(evaluation.onTimeDeliveryRate).toBeGreaterThanOrEqual(0);
      expect(evaluation.qualityAcceptanceRate).toBeGreaterThanOrEqual(0);
      expect(evaluation.qualityAcceptanceRate).toBeLessThanOrEqual(100);
      expect(['approved', 'conditional', 'not_recommended']).toContain(evaluation.recommendation);
    });

    it('should handle vendor with no orders', async () => {
      const evaluation = await evaluateVendorPerformance(testVendor2Id);

      expect(evaluation.totalOrders).toBe(0);
      expect(evaluation.qualityAcceptanceRate).toBe(100); // Default when no data
    });
  });

  // ============================================
  // AVL Management Tests
  // ============================================

  describe('addToAVL', () => {
    it('should add new vendor-item to AVL', async () => {
      // Create new item
      const newItemResult = sqlite.prepare(`
        INSERT INTO items (code, name_th, type, category, primary_unit, created_at)
        VALUES ('RM-AVL-NEW', 'New AVL Item', 'raw_material', 'other', 'kg', '${TODAY}')
      `).run();
      const newItemId = Number(newItemResult.lastInsertRowid);

      const avlId = await addToAVL(testVendorId, newItemId, true, FUTURE_DATE, TEST_USER_ID);

      expect(avlId).toBeGreaterThan(0);

      // Verify AVL entry
      const avl = sqlite.prepare('SELECT * FROM approved_vendor_list WHERE id = ?').get(avlId) as any;
      expect(avl.vendor_id).toBe(testVendorId);
      expect(avl.item_id).toBe(newItemId);
      expect(avl.is_preferred).toBe(1);
    });

    it('should update existing AVL entry', async () => {
      // Update existing entry for testVendorId + testItemId
      const avlId = await addToAVL(testVendorId, testItemId, false, FUTURE_DATE, TEST_USER_ID);

      expect(avlId).toBeGreaterThan(0);

      // Verify it was updated, not duplicated
      const avlEntries = sqlite.prepare(
        'SELECT * FROM approved_vendor_list WHERE vendor_id = ? AND item_id = ?'
      ).all(testVendorId, testItemId);
      expect(avlEntries.length).toBe(1);

      const avl = avlEntries[0] as any;
      expect(avl.is_preferred).toBe(0); // Changed from true to false
    });
  });

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Real-World Scenario: Complete Purchase Order Lifecycle', () => {
    it('should complete full PO workflow from creation to receipt', async () => {
      // 1. Create Purchase Order
      const lines = [
        { itemId: testItemId, quantity: 100, unitPrice: 500, requiredDate: FUTURE_DATE },
      ];
      const poId = await createPurchaseOrder(testVendorId, lines, TEST_USER_ID);

      let po = sqlite.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('draft');

      // 2. Submit for approval
      await updatePurchaseOrderStatus(poId, 'pending_approval', TEST_USER_ID);
      po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('pending_approval');

      // 3. Approve
      await updatePurchaseOrderStatus(poId, 'approved', TEST_USER_ID);
      po = sqlite.prepare('SELECT status, approved_by FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('approved');
      expect(po.approved_by).toBe(TEST_USER_ID);

      // 4. Send to vendor
      await updatePurchaseOrderStatus(poId, 'sent', TEST_USER_ID);
      po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('sent');

      // 5. Receive goods
      const poLine = sqlite.prepare('SELECT id FROM purchase_order_lines WHERE po_id = ?').get(poId) as any;
      const receivedLines = [
        { lineId: poLine.id, receivedQuantity: 100, lotNumber: 'LOT-FULL', expiryDate: FUTURE_EXPIRY },
      ];
      const lotIds = await receivePurchaseOrder(poId, receivedLines, testWarehouseId, TEST_USER_ID);

      po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('received');
      expect(lotIds.length).toBe(1);

      // 6. Close PO
      await updatePurchaseOrderStatus(poId, 'closed', TEST_USER_ID);
      po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(poId) as any;
      expect(po.status).toBe('closed');

      // Verify inventory lot in quarantine
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(lotIds[0]) as any;
      expect(lot.status).toBe('quarantine');
      expect(lot.quantity).toBe(100);
    });
  });

  describe('Real-World Scenario: VMI Replenishment Workflow', () => {
    it('should process VMI ASN and prepare for receipt', async () => {
      // 1. Generate current inventory snapshot
      const snapshot = await generateVMISnapshot(testVMIVendorId);
      expect(snapshot.items.length).toBeGreaterThan(0);

      // 2. Process incoming ASN from VMI vendor
      const asn = {
        asnNumber: 'ASN-VMI-001',
        vendorId: testVMIVendorId,
        expectedDeliveryDate: FUTURE_DATE,
        lines: [
          { itemCode: 'RM-001', quantity: 150, lotNumber: 'VMI-ASN-001' },
        ],
      };

      const result = await processVMIASN(asn, TEST_USER_ID);
      expect(result.poId).toBeGreaterThan(0);

      // 3. Verify PO is auto-approved and sent
      const po = sqlite.prepare('SELECT status FROM purchase_orders WHERE id = ?').get(result.poId) as any;
      expect(po.status).toBe('sent');

      // 4. Receive the goods
      const poLine = sqlite.prepare('SELECT id FROM purchase_order_lines WHERE po_id = ?').get(result.poId) as any;
      const receivedLines = [
        { lineId: poLine.id, receivedQuantity: 150, lotNumber: 'VMI-ASN-001', expiryDate: FUTURE_EXPIRY },
      ];
      const lotIds = await receivePurchaseOrder(result.poId, receivedLines, testWarehouseId, TEST_USER_ID);
      expect(lotIds.length).toBe(1);
    });
  });
});
