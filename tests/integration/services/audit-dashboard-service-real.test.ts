/**
 * Audit Dashboard Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T051)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete audit dashboard functionality with real-world scenarios.
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
  getAuditKpis,
  getRmReceivedYtd,
  getRmStatusBreakdown,
  getExpiryAlerts,
  getMinStockAlerts,
  getQcSummary,
  getProductionStatus,
  getPendingQcRelease,
  getFgApproved,
} from '@/lib/services/audit-dashboard-service';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;

    // Map data type
    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        def += 'INTEGER';
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

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteItems,
    schema.sqliteWarehouses,
    schema.sqliteInventoryLots,
    schema.sqliteQualityTests,
    schema.sqliteBOM,
    schema.sqliteWorkOrders,
  ];

  for (const table of tablesToCreate) {
    try {
      const createSql = generateCreateTableSql(table);
      sqlite.exec(createSql);
    } catch (err) {
      console.log(`Table creation note: ${err}`);
    }
  }
}

// Helper to get current date strings for testing
function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYearStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Audit Dashboard Service Real Integration Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Use schema-sync to create tables from Drizzle schema
    syncSchemaFromDrizzle();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clean tables before each test
    cleanTables();
  });

  function cleanTables() {
    sqlite.exec('DELETE FROM quality_tests');
    sqlite.exec('DELETE FROM work_orders');
    sqlite.exec('DELETE FROM bom');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    // Create test user
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'QC Manager', 'qa@test.com', 'hash123', 'qa_manager', 1)
    `);

    // Create test warehouse
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type)
      VALUES (1, 'WH001', 'Main Warehouse', 'raw_material')
    `);

    // Create test items (raw materials and finished goods)
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, primary_unit, on_hand, min_stock, reorder_point)
      VALUES
        (1, 'RM001', 'วัตถุดิบ A', 'Raw Material A', 'raw_material', 'kg', 100, 50, 75),
        (2, 'RM002', 'วัตถุดิบ B', 'Raw Material B', 'material', 'kg', 30, 40, 60),
        (3, 'PK001', 'บรรจุภัณฑ์ A', 'Packaging A', 'packaging', 'pcs', 500, 100, 200),
        (4, 'FG001', 'ผลิตภัณฑ์สำเร็จ A', 'Finished Good A', 'finished_good', 'bottle', 200, 50, 100),
        (5, 'FG002', 'ผลิตภัณฑ์สำเร็จ B', 'Finished Good B', 'product', 'bottle', 150, 30, 50)
    `);

    // Create test BOM (required for work orders)
    sqlite.exec(`
      INSERT INTO bom (id, code, name, product_id, batch_size, batch_unit)
      VALUES
        (1, 'BOM-FG001', 'BOM for FG001', 4, 100, 'bottle'),
        (2, 'BOM-FG002', 'BOM for FG002', 5, 100, 'bottle')
    `);

    const today = getTodayStr();
    const expiringSoon = addDays(15);
    const expiringLater = addDays(60);
    const expiredDate = addDays(-10);

    // Create test inventory lots with various statuses
    sqlite.exec(`
      INSERT INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, unit, status, received_date, expiry_date, created_at, updated_at)
      VALUES
        (1, 1, 'LOT-RM-001', 1, 50, 'kg', 'quarantine', '${today}', '${expiringLater}', '${today}', '${today}'),
        (2, 1, 'LOT-RM-002', 1, 30, 'kg', 'under_test', '${today}', '${expiringSoon}', '${today}', '${today}'),
        (3, 2, 'LOT-RM-003', 1, 20, 'kg', 'released', '${today}', '${expiringLater}', '${today}', '${today}'),
        (4, 2, 'LOT-RM-004', 1, 40, 'kg', 'rejected', '${today}', '${expiredDate}', '${today}', '${today}'),
        (5, 3, 'LOT-PK-001', 1, 100, 'pcs', 'released', '${today}', '${expiringLater}', '${today}', '${today}'),
        (6, 4, 'LOT-FG-001', 1, 100, 'bottle', 'released', '${today}', '${expiringLater}', '${today}', '${today}'),
        (7, 5, 'LOT-FG-002', 1, 75, 'bottle', 'released', '${today}', '${expiringLater}', '${today}', '${today}')
    `);

    // Create test quality tests
    sqlite.exec(`
      INSERT INTO quality_tests (id, lot_id, test_type, status, created_at, test_date)
      VALUES
        (1, 1, 'incoming', 'pass', '${today}', '${today}'),
        (2, 1, 'incoming', 'pass', '${today}', '${today}'),
        (3, 2, 'incoming', 'pending', '${today}', NULL),
        (4, 3, 'in_process', 'pass', '${today}', '${today}'),
        (5, 4, 'incoming', 'fail', '${today}', '${today}'),
        (6, 6, 'finished', 'pass', '${today}', '${today}'),
        (7, 7, 'finished', 'retest', '${today}', NULL)
    `);

    // Create test work orders
    sqlite.exec(`
      INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at)
      VALUES
        (1, 'WO-2024-001', 1, 4, 'BATCH-001', 100, 'bottle', 'completed', '${today}'),
        (2, 'WO-2024-002', 1, 4, 'BATCH-002', 50, 'bottle', 'in_progress', '${today}'),
        (3, 'WO-2024-003', 2, 5, 'BATCH-003', 75, 'bottle', 'planned', '${today}'),
        (4, 'WO-2024-004', 2, 5, 'BATCH-004', 100, 'bottle', 'released', '${today}'),
        (5, 'WO-2024-005', 1, 4, 'BATCH-005', 25, 'bottle', 'cancelled', '${today}')
    `);
  }

  // ============================================
  // Main Aggregation Function Tests
  // ============================================

  describe('getAuditKpis()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return all 8 KPIs in a single response', async () => {
      const kpis = await getAuditKpis();

      expect(kpis).toBeDefined();
      expect(kpis.rmReceivedYtd).toBeDefined();
      expect(kpis.rmStatusBreakdown).toBeDefined();
      expect(kpis.expiryAlerts).toBeDefined();
      expect(kpis.minStockAlerts).toBeDefined();
      expect(kpis.qcSummary).toBeDefined();
      expect(kpis.productionStatus).toBeDefined();
      expect(kpis.pendingQcRelease).toBeDefined();
      expect(kpis.fgApproved).toBeDefined();
      expect(kpis.generatedAt).toBeDefined();
    });

    it('should have valid timestamp format for generatedAt', async () => {
      const kpis = await getAuditKpis();

      expect(new Date(kpis.generatedAt).getTime()).not.toBeNaN();
    });
  });

  // ============================================
  // FR-047: RM Received YTD Tests
  // ============================================

  describe('getRmReceivedYtd()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return total lots received for raw materials YTD', async () => {
      const result = await getRmReceivedYtd();

      // We have 5 raw material lots (items 1, 2, 3)
      expect(result.totalLots).toBeGreaterThanOrEqual(5);
    });

    it('should calculate total quantity correctly', async () => {
      const result = await getRmReceivedYtd();

      // Sum of quantities for RM lots: 50 + 30 + 20 + 40 + 100 = 240
      expect(result.totalQuantity).toBeGreaterThanOrEqual(200);
    });

    it('should group by month correctly', async () => {
      const result = await getRmReceivedYtd();

      expect(Array.isArray(result.byMonth)).toBe(true);
      if (result.byMonth.length > 0) {
        expect(result.byMonth[0]).toHaveProperty('month');
        expect(result.byMonth[0]).toHaveProperty('lots');
        expect(result.byMonth[0]).toHaveProperty('quantity');
      }
    });
  });

  // ============================================
  // FR-048: RM Status Breakdown Tests
  // ============================================

  describe('getRmStatusBreakdown()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return status breakdown for raw materials', async () => {
      const result = await getRmStatusBreakdown();

      expect(result).toHaveProperty('quarantine');
      expect(result).toHaveProperty('underTest');
      expect(result).toHaveProperty('released');
      expect(result).toHaveProperty('rejected');
      expect(result).toHaveProperty('blocked');
      expect(result).toHaveProperty('total');
    });

    it('should count quarantine lots correctly', async () => {
      const result = await getRmStatusBreakdown();

      expect(result.quarantine).toBe(1); // LOT-RM-001
    });

    it('should count under_test lots correctly', async () => {
      const result = await getRmStatusBreakdown();

      expect(result.underTest).toBe(1); // LOT-RM-002
    });

    it('should count released lots correctly', async () => {
      const result = await getRmStatusBreakdown();

      // LOT-RM-003, LOT-PK-001 are released raw materials
      expect(result.released).toBeGreaterThanOrEqual(2);
    });

    it('should count rejected lots correctly', async () => {
      const result = await getRmStatusBreakdown();

      expect(result.rejected).toBe(1); // LOT-RM-004
    });

    it('should calculate total correctly', async () => {
      const result = await getRmStatusBreakdown();

      const calculatedTotal = result.quarantine + result.underTest + result.released + result.rejected + result.blocked;
      expect(result.total).toBe(calculatedTotal);
    });
  });

  // ============================================
  // FR-049: Expiry Alerts Tests
  // ============================================

  describe('getExpiryAlerts()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return expiry alerts structure', async () => {
      const result = await getExpiryAlerts();

      expect(result).toHaveProperty('expired');
      expect(result).toHaveProperty('expiringSoon');
      expect(result).toHaveProperty('expiringWarning');
      expect(result).toHaveProperty('items');
    });

    it('should detect expired lots', async () => {
      const result = await getExpiryAlerts();

      // LOT-RM-004 is expired (expiry date -10 days)
      expect(result.expired).toBeGreaterThanOrEqual(1);
    });

    it('should detect lots expiring within 30 days', async () => {
      const result = await getExpiryAlerts();

      // LOT-RM-002 expires in 15 days
      expect(result.expiringSoon).toBeGreaterThanOrEqual(1);
    });

    it('should include item details for expiring lots', async () => {
      const result = await getExpiryAlerts();

      if (result.items.length > 0) {
        expect(result.items[0]).toHaveProperty('lotId');
        expect(result.items[0]).toHaveProperty('lotNumber');
        expect(result.items[0]).toHaveProperty('itemName');
        expect(result.items[0]).toHaveProperty('expiryDate');
        expect(result.items[0]).toHaveProperty('daysUntilExpiry');
      }
    });
  });

  // ============================================
  // FR-050: Min Stock Alerts Tests
  // ============================================

  describe('getMinStockAlerts()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return min stock alerts structure', async () => {
      const result = await getMinStockAlerts();

      expect(result).toHaveProperty('criticalCount');
      expect(result).toHaveProperty('warningCount');
      expect(result).toHaveProperty('items');
    });

    it('should detect items below minimum stock', async () => {
      const result = await getMinStockAlerts();

      // RM002 has onHand=30, minStock=40 (below min)
      expect(result.criticalCount).toBeGreaterThanOrEqual(1);
    });

    it('should include item details for low stock items', async () => {
      const result = await getMinStockAlerts();

      if (result.items.length > 0) {
        expect(result.items[0]).toHaveProperty('itemId');
        expect(result.items[0]).toHaveProperty('itemCode');
        expect(result.items[0]).toHaveProperty('itemName');
        expect(result.items[0]).toHaveProperty('onHand');
        expect(result.items[0]).toHaveProperty('minStock');
      }
    });
  });

  // ============================================
  // FR-051: QC Summary Tests
  // ============================================

  describe('getQcSummary()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return QC summary structure', async () => {
      const result = await getQcSummary();

      expect(result).toHaveProperty('totalTests');
      expect(result).toHaveProperty('passedTests');
      expect(result).toHaveProperty('failedTests');
      expect(result).toHaveProperty('pendingTests');
      expect(result).toHaveProperty('passRate');
      expect(result).toHaveProperty('byTestType');
    });

    it('should count total tests correctly', async () => {
      const result = await getQcSummary();

      // We created 7 tests
      expect(result.totalTests).toBe(7);
    });

    it('should count passed tests correctly', async () => {
      const result = await getQcSummary();

      // Tests 1, 2, 4, 6 are passed
      expect(result.passedTests).toBe(4);
    });

    it('should count failed tests correctly', async () => {
      const result = await getQcSummary();

      // Test 5 is failed
      expect(result.failedTests).toBe(1);
    });

    it('should count pending tests correctly', async () => {
      const result = await getQcSummary();

      // Tests 3 and 7 are pending/retest
      expect(result.pendingTests).toBe(2);
    });

    it('should calculate pass rate correctly', async () => {
      const result = await getQcSummary();

      // 4 passed out of 7 = ~57%
      expect(result.passRate).toBeGreaterThanOrEqual(50);
      expect(result.passRate).toBeLessThanOrEqual(60);
    });

    it('should group by test type', async () => {
      const result = await getQcSummary();

      expect(Array.isArray(result.byTestType)).toBe(true);
      if (result.byTestType.length > 0) {
        expect(result.byTestType[0]).toHaveProperty('testType');
        expect(result.byTestType[0]).toHaveProperty('passed');
        expect(result.byTestType[0]).toHaveProperty('failed');
        expect(result.byTestType[0]).toHaveProperty('pending');
      }
    });
  });

  // ============================================
  // FR-052: Production Status Tests
  // ============================================

  describe('getProductionStatus()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return production status structure', async () => {
      const result = await getProductionStatus();

      expect(result).toHaveProperty('planned');
      expect(result).toHaveProperty('released');
      expect(result).toHaveProperty('inProgress');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('completionRate');
    });

    it('should count completed work orders', async () => {
      const result = await getProductionStatus();

      // WO-2024-001 is completed
      expect(result.completed).toBe(1);
    });

    it('should count in_progress work orders', async () => {
      const result = await getProductionStatus();

      // WO-2024-002 is in_progress
      expect(result.inProgress).toBe(1);
    });

    it('should count planned work orders', async () => {
      const result = await getProductionStatus();

      // WO-2024-003 is planned
      expect(result.planned).toBe(1);
    });

    it('should count released work orders', async () => {
      const result = await getProductionStatus();

      // WO-2024-004 is released
      expect(result.released).toBe(1);
    });

    it('should count cancelled work orders', async () => {
      const result = await getProductionStatus();

      // WO-2024-005 is cancelled
      expect(result.cancelled).toBe(1);
    });

    it('should calculate completion rate correctly', async () => {
      const result = await getProductionStatus();

      // 1 completed out of 4 non-cancelled = 25%
      expect(result.completionRate).toBe(25);
    });

    it('should calculate total correctly', async () => {
      const result = await getProductionStatus();

      expect(result.total).toBe(5);
    });
  });

  // ============================================
  // FR-053: Pending QC Release Tests
  // ============================================

  describe('getPendingQcRelease()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return pending QC release structure', async () => {
      const result = await getPendingQcRelease();

      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('items');
    });

    it('should count lots under test', async () => {
      const result = await getPendingQcRelease();

      // LOT-RM-002 is under_test
      expect(result.count).toBeGreaterThanOrEqual(1);
    });

    it('should include item details', async () => {
      const result = await getPendingQcRelease();

      if (result.items.length > 0) {
        expect(result.items[0]).toHaveProperty('lotId');
        expect(result.items[0]).toHaveProperty('lotNumber');
        expect(result.items[0]).toHaveProperty('itemName');
        expect(result.items[0]).toHaveProperty('daysWaiting');
      }
    });
  });

  // ============================================
  // FR-054: FG Approved YTD Tests
  // ============================================

  describe('getFgApproved()', () => {
    beforeEach(() => {
      seedTestData();
    });

    it('should return FG approved structure', async () => {
      const result = await getFgApproved();

      expect(result).toHaveProperty('totalBatches');
      expect(result).toHaveProperty('totalQuantity');
      expect(result).toHaveProperty('byMonth');
    });

    it('should count approved FG batches', async () => {
      const result = await getFgApproved();

      // LOT-FG-001 and LOT-FG-002 are released finished goods
      expect(result.totalBatches).toBe(2);
    });

    it('should calculate total quantity correctly', async () => {
      const result = await getFgApproved();

      // LOT-FG-001 (100) + LOT-FG-002 (75) = 175
      expect(result.totalQuantity).toBe(175);
    });

    it('should group by month', async () => {
      const result = await getFgApproved();

      expect(Array.isArray(result.byMonth)).toBe(true);
      if (result.byMonth.length > 0) {
        expect(result.byMonth[0]).toHaveProperty('month');
        expect(result.byMonth[0]).toHaveProperty('batches');
        expect(result.byMonth[0]).toHaveProperty('quantity');
      }
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty database gracefully', async () => {
      // Database is already clean from beforeEach

      const kpis = await getAuditKpis();

      expect(kpis.rmReceivedYtd.totalLots).toBe(0);
      expect(kpis.rmReceivedYtd.totalQuantity).toBe(0);
      expect(kpis.rmStatusBreakdown.total).toBe(0);
      expect(kpis.expiryAlerts.expired).toBe(0);
      expect(kpis.minStockAlerts.criticalCount).toBe(0);
      expect(kpis.qcSummary.totalTests).toBe(0);
      expect(kpis.productionStatus.total).toBe(0);
      expect(kpis.pendingQcRelease.count).toBe(0);
      expect(kpis.fgApproved.totalBatches).toBe(0);
    });

    it('should handle QC pass rate with zero tests', async () => {
      const result = await getQcSummary();

      // With no tests, pass rate should be 0 (not NaN)
      expect(result.passRate).toBe(0);
    });

    it('should handle production completion rate with all cancelled', async () => {
      // Add test data for cancelled work order test
      sqlite.exec(`
        INSERT INTO items (id, code, name_th, name_en, type, primary_unit, on_hand)
        VALUES (10, 'TEST001', 'Test', 'Test', 'finished_good', 'pcs', 100)
      `);
      sqlite.exec(`
        INSERT INTO bom (id, code, name, product_id, batch_size, batch_unit)
        VALUES (10, 'BOM-TEST', 'Test BOM', 10, 100, 'pcs')
      `);
      sqlite.exec(`
        INSERT INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, unit, status, created_at)
        VALUES (10, 'WO-TEST-001', 10, 10, 'TEST-BATCH', 100, 'pcs', 'cancelled', '${getTodayStr()}')
      `);

      const result = await getProductionStatus();

      // With all cancelled, completion rate should be 0
      expect(result.completionRate).toBe(0);
    });
  });
});
