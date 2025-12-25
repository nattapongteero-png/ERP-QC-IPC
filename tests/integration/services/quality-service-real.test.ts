/**
 * Quality Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7 - Quality Control)
 *
 * These tests call actual service functions with real SQLite database
 * to verify Quality Control module functionality with real-world scenarios.
 *
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 *
 * NOTE: Some database-dependent functions are skipped due to schema mismatch
 * between quality.service.ts and the current Drizzle schema. The service was
 * written for a different schema version. See individual test blocks for details.
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

// Mock the database module - need to mock both db() and getSqliteDb()
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

// Mock inventory.service updateLotStatus
vi.mock('@/lib/services/inventory.service', () => ({
  updateLotStatus: vi.fn(() => Promise.resolve()),
}));

// Import service after mocking - all functions now that schema is aligned
import {
  calculateSamplingPlan,
  createQCTestRequest,
  recordTestResult,
  evaluateLotRelease,
  releaseLot,
  generateCOA,
  createDeviation,
  updateDeviationInvestigation,
  closeDeviation,
  getDeviationStatistics,
} from '@/lib/services/quality.service';

// ============================================
// Schema Sync Helper
// ============================================
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
  columnType?: string;
  primary?: boolean;
  autoIncrement?: boolean;
  notNull?: boolean;
  hasDefault?: boolean;
  default?: unknown;
  isUnique?: boolean;
}

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;

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

describe('Quality Service Real Integration Tests', () => {
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
      schema.sqliteQualitySpecs,
      schema.sqliteQualityTests,
      schema.sqliteDeviations,
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
    // Clean up tables before each test (reverse order for FK)
    sqlite.exec('DELETE FROM quality_tests');
    sqlite.exec('DELETE FROM quality_specs');
    sqlite.exec('DELETE FROM deviations');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM warehouse_locations');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM vendors');
    sqlite.exec('DELETE FROM users');

    // Seed base data
    sqlite.exec(`
      INSERT INTO users (id, email, password, name, role, is_active)
      VALUES
        (1, 'qa.manager@test.com', 'hash', 'QA Manager', 'qa_manager', 1),
        (2, 'lab.tech@test.com', 'hash', 'Lab Technician', 'lab', 1)
    `);

    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active)
      VALUES (1, 'VEN-001', 'Raw Material Supplier', 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, category, primary_unit, shelf_life_days, on_hand, on_hand_cost, is_lot_controlled, is_fefo, is_active)
      VALUES
        (1, 'RM-001', 'ฟ้าทะลายโจรผง', 'Andrographis Powder', 'raw_material', 'herbal', 'kg', 730, 0, 0, 1, 1, 1),
        (2, 'FG-001', 'ฟ้าทะลายโจรแคปซูล', 'Andrographis Capsule', 'finished_product', 'capsule', 'box', 365, 0, 0, 1, 1, 1)
    `);

    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-RM', 'Raw Material Warehouse', 'raw_materials', 1),
        (2, 'WH-QA', 'Quarantine Area', 'quarantine', 1)
    `);
  });

  // ============================================
  // AQL Sampling Plan Tests (Pure Function)
  // ============================================
  describe('AQL Sampling Plan Calculation (ISO 2859-1)', () => {
    describe('Sample Size Code Letter Selection', () => {
      it('should select correct code letter for small lot (2-8 units)', () => {
        const plan = calculateSamplingPlan(5, 'II', 1.0);

        // For lot size 2-8 and level II, code letter should be 'A'
        expect(plan.lotSize).toBe(5);
        expect(plan.inspectionLevel).toBe('II');
        expect(plan.sampleSize).toBe(2); // Code A = 2 samples
      });

      it('should select correct code letter for medium lot (51-90 units)', () => {
        const plan = calculateSamplingPlan(75, 'II', 1.0);

        // For lot size 51-90 and level II, code letter should be 'E'
        expect(plan.sampleSize).toBe(13); // Code E = 13 samples
      });

      it('should select correct code letter for large lot (501-1200 units)', () => {
        const plan = calculateSamplingPlan(1000, 'II', 1.0);

        // For lot size 501-1200 and level II, code letter should be 'J'
        expect(plan.sampleSize).toBe(80); // Code J = 80 samples
      });

      it('should select correct code letter for very large lot (10001-35000)', () => {
        const plan = calculateSamplingPlan(25000, 'II', 1.0);

        // For lot size 10001-35000 and level II, code letter should be 'M'
        expect(plan.sampleSize).toBe(315); // Code M = 315 samples
      });
    });

    describe('Inspection Level Impact', () => {
      it('should use smaller sample for Level I (reduced inspection)', () => {
        const planLevel1 = calculateSamplingPlan(100, 'I', 1.0);
        const planLevel2 = calculateSamplingPlan(100, 'II', 1.0);

        // Level I should have smaller or equal sample size than Level II
        expect(planLevel1.sampleSize).toBeLessThanOrEqual(planLevel2.sampleSize);
      });

      it('should use larger sample for Level III (tightened inspection)', () => {
        const planLevel2 = calculateSamplingPlan(100, 'II', 1.0);
        const planLevel3 = calculateSamplingPlan(100, 'III', 1.0);

        // Level III should have larger or equal sample size than Level II
        expect(planLevel3.sampleSize).toBeGreaterThanOrEqual(planLevel2.sampleSize);
      });
    });

    describe('AQL (Acceptable Quality Level) Impact', () => {
      it('should calculate correct accept/reject numbers for AQL 1.0', () => {
        const plan = calculateSamplingPlan(100, 'II', 1.0);

        expect(plan.aql).toBe(1.0);
        // Accept and reject numbers depend on code letter
        expect(plan.acceptNumber).toBeGreaterThanOrEqual(0);
        expect(plan.rejectNumber).toBeGreaterThan(plan.acceptNumber);
      });

      it('should calculate correct accept/reject numbers for AQL 2.5', () => {
        const plan = calculateSamplingPlan(100, 'II', 2.5);

        expect(plan.aql).toBe(2.5);
        // Higher AQL means more defects are acceptable
        expect(plan.acceptNumber).toBeGreaterThanOrEqual(0);
        expect(plan.rejectNumber).toBeGreaterThan(plan.acceptNumber);
      });

      it('should have stricter limits for lower AQL', () => {
        const planLowAQL = calculateSamplingPlan(50, 'II', 0.65);
        const planHighAQL = calculateSamplingPlan(50, 'II', 4.0);

        // Lower AQL should have lower or equal accept number
        expect(planLowAQL.acceptNumber).toBeLessThanOrEqual(planHighAQL.acceptNumber);
      });
    });

    describe('Pharma-Specific Scenarios', () => {
      it('should handle incoming raw material inspection (typical 100kg lot)', () => {
        // Typical raw material inspection scenario
        const plan = calculateSamplingPlan(100, 'II', 1.0);

        expect(plan.lotSize).toBe(100);
        expect(plan.inspectionLevel).toBe('II');
        expect(plan.sampleSize).toBeGreaterThan(0);
        expect(plan.acceptNumber).toBeGreaterThanOrEqual(0);
        expect(plan.rejectNumber).toBeGreaterThan(0);
      });

      it('should handle finished product batch (typical 5000 unit batch)', () => {
        // Typical finished product batch
        const plan = calculateSamplingPlan(5000, 'II', 0.65);

        expect(plan.sampleSize).toBeGreaterThan(50); // Should sample adequately
        expect(plan.aql).toBe(0.65); // Stricter AQL for finished products
      });

      it('should handle small pilot batch (50 units)', () => {
        const plan = calculateSamplingPlan(50, 'II', 1.0);

        expect(plan.sampleSize).toBeLessThanOrEqual(50);
        expect(plan.sampleSize).toBeGreaterThan(0);
      });

      it('should handle very small batch requiring 100% inspection', () => {
        const plan = calculateSamplingPlan(3, 'II', 1.0);

        // For very small lots, sample size might equal lot size
        expect(plan.sampleSize).toBeLessThanOrEqual(plan.lotSize);
      });
    });

    describe('Edge Cases', () => {
      it('should handle minimum lot size', () => {
        const plan = calculateSamplingPlan(2, 'II', 1.0);

        expect(plan.sampleSize).toBe(2);
        expect(plan.acceptNumber).toBe(0);
        expect(plan.rejectNumber).toBe(1);
      });

      it('should handle maximum typical lot size', () => {
        const plan = calculateSamplingPlan(500000, 'II', 1.0);

        expect(plan.sampleSize).toBeGreaterThan(0);
        expect(plan.lotSize).toBe(500000);
      });

      it('should handle Level I inspection consistently', () => {
        const plan1 = calculateSamplingPlan(100, 'I', 1.0);
        const plan2 = calculateSamplingPlan(100, 'I', 1.0);

        // Same input should yield same output
        expect(plan1.sampleSize).toBe(plan2.sampleSize);
        expect(plan1.acceptNumber).toBe(plan2.acceptNumber);
      });
    });
  });

  // ============================================
  // Database-Dependent Tests (T058-T061)
  // Schema aligned via Phase 0 tasks - now functional
  // ============================================

  describe('QC Test Request (T058)', () => {
    beforeEach(() => {
      // Create inventory lot for testing
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-QC-001', 'BATCH-QC-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);

      // Create quality spec
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, min_value, max_value, unit, is_critical, is_active)
        VALUES (1, 1, 'Moisture Content', 'USP <731>', NULL, 10, '%', 1, 1)
      `);
    });

    it('should create QC test request for incoming material', async () => {
      const testIds = await createQCTestRequest(1, ['incoming'], TEST_USER_ID);

      expect(testIds).toHaveLength(1);
      expect(testIds[0]).toBeGreaterThan(0);

      // Verify test was created in database
      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testIds[0]) as any;
      expect(test.lot_id).toBe(1);
      expect(test.test_type).toBe('incoming');
      expect(test.status).toBe('pending');
      expect(test.requested_by).toBe(TEST_USER_ID);
    });

    it('should create multiple test requests for different test types', async () => {
      const testIds = await createQCTestRequest(1, ['incoming', 'identity', 'assay'], TEST_USER_ID);

      expect(testIds).toHaveLength(3);

      const tests = sqlite.prepare('SELECT * FROM quality_tests WHERE lot_id = 1').all() as any[];
      expect(tests).toHaveLength(3);
      expect(tests.map(t => t.test_type)).toContain('incoming');
      expect(tests.map(t => t.test_type)).toContain('identity');
      expect(tests.map(t => t.test_type)).toContain('assay');
    });

    it('should calculate and store sample size from AQL plan', async () => {
      const testIds = await createQCTestRequest(1, ['incoming'], TEST_USER_ID);

      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testIds[0]) as any;
      expect(test.sample_size).toBeGreaterThan(0);
    });

    it('should update lot status to under_test', async () => {
      await createQCTestRequest(1, ['incoming'], TEST_USER_ID);

      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as any;
      expect(lot.status).toBe('under_test');
    });

    it('should throw error for non-existent lot', async () => {
      await expect(createQCTestRequest(999, ['incoming'], TEST_USER_ID))
        .rejects.toThrow('Lot 999 not found');
    });
  });

  describe('Test Result Recording (T059)', () => {
    let testId: number;

    beforeEach(async () => {
      // Create lot
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-RES-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);

      // Create spec with range (using actual schema columns)
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, specification, min_value, max_value, unit, is_critical, is_active)
        VALUES (1, 1, 'Moisture Content', 'USP <731>', 'NMT 10%', 0, 10, '%', 1, 1)
      `);

      // Create test record (using actual schema columns)
      sqlite.exec(`
        INSERT INTO quality_tests (id, lot_id, spec_id, test_type, status)
        VALUES (1, 1, 1, 'incoming', 'pending')
      `);
      testId = 1;
    });

    it('should record passing test result', async () => {
      const result = await recordTestResult(testId, 8.5, 'Within spec', TEST_USER_ID);

      expect(result.status).toBe('pass');
      expect(result.deviationId).toBeUndefined();

      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE id = ?').get(testId) as any;
      expect(test.numeric_result).toBe(8.5);
      expect(test.result).toBe('Within spec');
      expect(test.status).toBe('passed');
      expect(test.tested_by).toBe(TEST_USER_ID);
    });

    it('should record failing test result and create OOS deviation', async () => {
      const result = await recordTestResult(testId, 12.5, 'Out of spec', TEST_USER_ID);

      expect(result.status).toBe('fail');
      expect(result.deviationId).toBeGreaterThan(0);

      // Verify deviation was created
      const deviation = sqlite.prepare('SELECT * FROM deviations WHERE id = ?').get(result.deviationId) as any;
      expect(deviation.type).toBe('OOS');
      expect(deviation.severity).toBe('major');
      expect(deviation.status).toBe('open');
      expect(deviation.lot_id).toBe(1);
    });

    it('should handle text-based test results', async () => {
      // Create text-based spec (using specification for expected value)
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, specification, is_critical, is_active)
        VALUES (2, 1, 'Color Check', 'Visual', 'brown', 1, 1)
      `);
      sqlite.exec(`
        INSERT INTO quality_tests (id, lot_id, spec_id, test_type, status)
        VALUES (2, 1, 2, 'incoming', 'pending')
      `);

      const result = await recordTestResult(2, null, 'brown', TEST_USER_ID);
      expect(result.status).toBe('pass');
    });

    it('should throw error for non-existent test', async () => {
      await expect(recordTestResult(999, 5.0, 'Test', TEST_USER_ID))
        .rejects.toThrow('Test 999 not found');
    });
  });

  describe('Deviation Management (T059 continued)', () => {
    beforeEach(() => {
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-DEV-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);
    });

    it('should create deviation for lot-related issue', async () => {
      const deviationId = await createDeviation(
        1,  // lotId
        null,  // workOrderId
        'OOS',
        'major',
        'Moisture content 15% exceeds max 10%',
        TEST_USER_ID
      );

      expect(deviationId).toBeGreaterThan(0);

      const deviation = sqlite.prepare('SELECT * FROM deviations WHERE id = ?').get(deviationId) as any;
      expect(deviation.lot_id).toBe(1);
      expect(deviation.type).toBe('OOS');
      expect(deviation.severity).toBe('major');
      expect(deviation.status).toBe('open');
      expect(deviation.deviation_number).toMatch(/^DEV-\d{6}-\d{4}$/);
    });

    it('should update deviation with investigation details', async () => {
      // Create deviation first
      const deviationId = await createDeviation(1, null, 'OOS', 'major', 'Test failure', TEST_USER_ID);

      // Update with investigation
      const updated = await updateDeviationInvestigation(
        deviationId,
        'Storage temperature exceeded during transport',
        'Reject affected lot and retrain receiving staff',
        'Install temperature monitoring at receiving dock',
        2, // responsiblePerson
        '2024-12-31',
        TEST_USER_ID
      );

      expect(updated).toBe(true);

      const deviation = sqlite.prepare('SELECT * FROM deviations WHERE id = ?').get(deviationId) as any;
      expect(deviation.root_cause).toContain('temperature');
      expect(deviation.corrective_action).toContain('Reject');
      expect(deviation.preventive_action).toContain('monitoring');
      expect(deviation.status).toBe('investigation');
    });

    it('should close deviation with closure notes', async () => {
      // Create and investigate deviation
      const deviationId = await createDeviation(1, null, 'OOS', 'minor', 'Minor issue', TEST_USER_ID);
      await updateDeviationInvestigation(deviationId, 'Root cause', 'CA', 'PA', 2, '2024-12-31', TEST_USER_ID);

      // Close deviation
      const closed = await closeDeviation(deviationId, 'Verified effectiveness of CAPA', TEST_USER_ID);

      expect(closed).toBe(true);

      const deviation = sqlite.prepare('SELECT * FROM deviations WHERE id = ?').get(deviationId) as any;
      expect(deviation.status).toBe('closed');
      expect(deviation.closure_notes).toContain('effectiveness');
      expect(deviation.closed_by).toBe(TEST_USER_ID);
    });

    it('should not close deviation without CAPA documentation', async () => {
      const deviationId = await createDeviation(1, null, 'OOS', 'major', 'Issue', TEST_USER_ID);

      await expect(closeDeviation(deviationId, 'Trying to close', TEST_USER_ID))
        .rejects.toThrow('Cannot close deviation without CAPA documentation');
    });

    it('should get deviation statistics', async () => {
      // Create multiple deviations
      await createDeviation(1, null, 'OOS', 'critical', 'Critical 1', TEST_USER_ID);
      await createDeviation(1, null, 'process', 'major', 'Major 1', TEST_USER_ID);
      await createDeviation(1, null, 'documentation', 'minor', 'Minor 1', TEST_USER_ID);

      const stats = await getDeviationStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byStatus['open']).toBe(3);
      expect(stats.bySeverity['critical']).toBe(1);
      expect(stats.bySeverity['major']).toBe(1);
      expect(stats.bySeverity['minor']).toBe(1);
    });
  });

  describe('COA Generation (T061)', () => {
    beforeEach(() => {
      // Create lot with full data
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, quantity, unit, status, warehouse_id, manufacturing_date, expiry_date, coa_number)
        VALUES (1, 1, 'LOT-COA-001', 'BATCH-COA-001', 50, 'kg', 'released', 1, date('now', '-30 days'), date('now', '+700 days'), 'COA-2024-0001')
      `);

      // Create specs (spec_type is represented by test_method and specification columns)
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, specification, min_value, max_value, unit, is_critical, is_active)
        VALUES
          (1, 1, 'Moisture Content', 'USP <731>', 'NMT 10%', 0, 10, '%', 1, 1),
          (2, 1, 'Andrographolide', 'HPLC', 'NLT 1%', 1, NULL, '%', 1, 1)
      `);

      // Create completed tests (using test_date instead of tested_at)
      sqlite.exec(`
        INSERT INTO quality_tests (id, lot_id, spec_id, test_type, numeric_result, result, status, tested_by, test_date)
        VALUES
          (1, 1, 1, 'incoming', 8.2, '8.2% moisture', 'passed', 2, datetime('now')),
          (2, 1, 2, 'incoming', 1.5, '1.5% andrographolide', 'passed', 2, datetime('now'))
      `);
    });

    it('should generate COA with all test results', async () => {
      const coa = await generateCOA(1);

      expect(coa.documentNumber).toBe('COA-2024-0001');
      expect(coa.productInfo.lotNumber).toBe('LOT-COA-001');
      expect(coa.productInfo.batchNumber).toBe('BATCH-COA-001');
      expect(coa.productInfo.quantity).toBe(50);
      expect(coa.testResults).toHaveLength(2);
      expect(coa.conclusion).toBe('PASS');
    });

    it('should include test results with specifications', async () => {
      const coa = await generateCOA(1);

      const moistureTest = coa.testResults.find(t => t.testType === 'incoming');
      expect(moistureTest).toBeDefined();
      expect(moistureTest?.status).toBe('pass');
    });

    it('should mark COA as FAIL if any test failed', async () => {
      // Add a failed test
      sqlite.exec(`
        INSERT INTO quality_tests (id, lot_id, spec_id, test_type, numeric_result, result, status, tested_by, test_date)
        VALUES (3, 1, 1, 'stability', 12, '12% moisture - FAIL', 'failed', 2, datetime('now'))
      `);

      const coa = await generateCOA(1);

      expect(coa.conclusion).toBe('FAIL');
      expect(coa.testResults.some(t => t.status === 'fail')).toBe(true);
    });

    it('should generate new COA number if not existing', async () => {
      // Create lot without COA number
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, expiry_date)
        VALUES (2, 1, 'LOT-COA-002', 25, 'kg', 'released', 1, date('now', '+365 days'))
      `);
      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, numeric_result, status, tested_by, test_date)
        VALUES (2, 1, 'incoming', 7.0, 'passed', 2, datetime('now'))
      `);

      const coa = await generateCOA(2);

      expect(coa.documentNumber).toMatch(/^COA-\d{6}-\d{4}$/);
    });

    it('should throw error for non-existent lot', async () => {
      await expect(generateCOA(999)).rejects.toThrow('Lot 999 not found');
    });
  });

  // ============================================
  // Direct Database Tests (Working with actual schema)
  // These tests use direct SQL to test GMP quality control patterns
  // ============================================
  describe('Quality Specifications (Direct Database)', () => {
    beforeEach(() => {
      // Seed quality specs for testing
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, specification, min_value, max_value, unit, is_critical, is_active)
        VALUES
          (1, 1, 'Moisture Content', 'USP <731>', 'Max 10%', NULL, 10, '%', 1, 1),
          (2, 1, 'Andrographolide Content', 'HPLC', 'Min 1%', 1, NULL, '%', 1, 1),
          (3, 1, 'Total Ash', 'USP <281>', 'Max 15%', NULL, 15, '%', 0, 1),
          (4, 1, 'Microbial Limit', 'USP <61>', 'Max 1000 CFU/g', NULL, 1000, 'CFU/g', 1, 1),
          (5, 2, 'Dissolution', 'USP <711>', 'Min 75% in 45 min', 75, NULL, '%', 1, 1)
      `);
    });

    it('should have specifications for raw materials', () => {
      const specs = sqlite.prepare(
        'SELECT * FROM quality_specs WHERE item_id = ? AND is_active = 1'
      ).all(1) as any[];

      expect(specs.length).toBe(4);
      expect(specs.map(s => s.test_name)).toContain('Moisture Content');
      expect(specs.map(s => s.test_name)).toContain('Andrographolide Content');
    });

    it('should identify critical quality attributes', () => {
      const criticalSpecs = sqlite.prepare(
        'SELECT * FROM quality_specs WHERE item_id = ? AND is_critical = 1'
      ).all(1) as any[];

      expect(criticalSpecs.length).toBe(3); // Moisture, Andrographolide, Microbial
      expect(criticalSpecs.every(s => s.is_critical === 1)).toBe(true);
    });

    it('should have range specifications with min/max values', () => {
      const spec = sqlite.prepare(
        'SELECT * FROM quality_specs WHERE test_name = ?'
      ).get('Moisture Content') as any;

      expect(spec.max_value).toBe(10);
      expect(spec.unit).toBe('%');
    });
  });

  describe('Quality Test Records (Direct Database)', () => {
    beforeEach(() => {
      // Create inventory lot for testing
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, batch_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-RM-001', 'BATCH-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);

      // Create quality spec
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, test_method, min_value, max_value, unit, is_critical, is_active)
        VALUES (1, 1, 'Moisture Content', 'USP <731>', NULL, 10, '%', 1, 1)
      `);
    });

    it('should record incoming material test', () => {
      // Insert test using actual schema columns
      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, sample_number, test_date, result, numeric_result, status, tested_by)
        VALUES (1, 1, 'incoming', 'S-001', date('now'), '8.5% moisture', 8.5, 'pass', 2)
      `);

      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE lot_id = 1').get() as any;

      expect(test.test_type).toBe('incoming');
      expect(test.numeric_result).toBe(8.5);
      expect(test.status).toBe('pass');
    });

    it('should track failed tests', () => {
      // Insert failing test (moisture > 10%)
      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, sample_number, result, numeric_result, status, tested_by)
        VALUES (1, 1, 'incoming', 'S-002', '12% moisture - FAIL', 12, 'fail', 2)
      `);

      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE status = ?').get('fail') as any;

      expect(test.numeric_result).toBe(12);
      expect(test.status).toBe('fail');
    });

    it('should track test approval workflow', () => {
      // Insert test pending approval
      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, result, numeric_result, status, tested_by)
        VALUES (1, 1, 'incoming', '8.5%', 8.5, 'pending', 2)
      `);

      // QA Manager approves
      sqlite.exec(`
        UPDATE quality_tests SET status = 'pass', approved_by = 1, approved_at = datetime('now')
        WHERE lot_id = 1 AND status = 'pending'
      `);

      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE lot_id = 1').get() as any;

      expect(test.status).toBe('pass');
      expect(test.approved_by).toBe(1);
      expect(test.approved_at).toBeTruthy();
    });
  });

  describe('Deviation Records (Direct Database)', () => {
    beforeEach(() => {
      // Create lot for testing
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-DEV-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);
    });

    it('should record OOS deviation with correct schema', () => {
      // Insert deviation using actual schema columns
      sqlite.exec(`
        INSERT INTO deviations (
          deviation_number, title, description, source_type, source_id,
          severity, status, reported_by
        ) VALUES (
          'DEV-2024-0001',
          'OOS: Moisture Content',
          'Moisture content 12% exceeds specification max 10%',
          'quality',
          1,
          'major',
          'open',
          2
        )
      `);

      const dev = sqlite.prepare('SELECT * FROM deviations WHERE deviation_number = ?').get('DEV-2024-0001') as any;

      expect(dev.title).toBe('OOS: Moisture Content');
      expect(dev.severity).toBe('major');
      expect(dev.status).toBe('open');
      expect(dev.source_type).toBe('quality');
    });

    it('should track deviation investigation and CAPA', () => {
      // Create initial deviation
      sqlite.exec(`
        INSERT INTO deviations (deviation_number, title, description, source_type, source_id, severity, status, reported_by)
        VALUES ('DEV-2024-0002', 'OOS Investigation', 'Test failure', 'quality', 1, 'major', 'open', 2)
      `);

      // Add investigation results and CAPA
      sqlite.exec(`
        UPDATE deviations SET
          status = 'investigating',
          root_cause = 'Improper storage conditions during transport',
          corrective_action = 'Reject affected lot, review incoming inspection',
          preventive_action = 'Implement temperature monitoring during transport',
          assigned_to = 1,
          due_date = date('now', '+30 days')
        WHERE deviation_number = 'DEV-2024-0002'
      `);

      const dev = sqlite.prepare('SELECT * FROM deviations WHERE deviation_number = ?').get('DEV-2024-0002') as any;

      expect(dev.status).toBe('investigating');
      expect(dev.root_cause).toContain('storage conditions');
      expect(dev.corrective_action).toContain('Reject');
      expect(dev.preventive_action).toContain('temperature monitoring');
    });

    it('should close deviation with closure documentation', () => {
      // Create and update deviation
      sqlite.exec(`
        INSERT INTO deviations (
          deviation_number, title, description, source_type, source_id,
          severity, status, root_cause, corrective_action, preventive_action, reported_by
        ) VALUES (
          'DEV-2024-0003', 'Closure Test', 'Test', 'quality', 1,
          'minor', 'investigating', 'Known cause', 'Action taken', 'Prevention added', 2
        )
      `);

      // Close deviation
      sqlite.exec(`
        UPDATE deviations SET
          status = 'closed',
          closed_by = 1,
          closed_at = datetime('now')
        WHERE deviation_number = 'DEV-2024-0003'
      `);

      const dev = sqlite.prepare('SELECT * FROM deviations WHERE deviation_number = ?').get('DEV-2024-0003') as any;

      expect(dev.status).toBe('closed');
      expect(dev.closed_by).toBe(1);
      expect(dev.closed_at).toBeTruthy();
    });

    it('should categorize deviations by severity', () => {
      // Insert deviations of different severities
      sqlite.exec(`
        INSERT INTO deviations (deviation_number, title, description, source_type, severity, status, reported_by)
        VALUES
          ('DEV-C-001', 'Critical Issue', 'Description', 'quality', 'critical', 'open', 1),
          ('DEV-M-001', 'Major Issue', 'Description', 'quality', 'major', 'open', 1),
          ('DEV-M-002', 'Major Issue 2', 'Description', 'quality', 'major', 'open', 1),
          ('DEV-N-001', 'Minor Issue', 'Description', 'quality', 'minor', 'open', 1)
      `);

      const stats = sqlite.prepare(`
        SELECT severity, COUNT(*) as count
        FROM deviations
        GROUP BY severity
        ORDER BY
          CASE severity
            WHEN 'critical' THEN 1
            WHEN 'major' THEN 2
            WHEN 'minor' THEN 3
          END
      `).all() as any[];

      expect(stats.find(s => s.severity === 'critical')?.count).toBe(1);
      expect(stats.find(s => s.severity === 'major')?.count).toBe(2);
      expect(stats.find(s => s.severity === 'minor')?.count).toBe(1);
    });
  });

  describe('Integrated QC Workflow (Direct Database)', () => {
    it('should complete incoming inspection workflow', () => {
      // 1. Receive material in quarantine
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-INC-001', 200, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);

      // 2. Create specs and conduct tests
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, min_value, max_value, unit, is_critical, is_active)
        VALUES (1, 1, 'Moisture', NULL, 10, '%', 1, 1)
      `);

      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, numeric_result, status, tested_by)
        VALUES (1, 1, 'incoming', 8.2, 'pass', 2)
      `);

      // 3. Approve and release
      sqlite.exec(`
        UPDATE quality_tests SET approved_by = 1, approved_at = datetime('now') WHERE lot_id = 1
      `);

      sqlite.exec(`
        UPDATE inventory_lots SET status = 'released' WHERE id = 1
      `);

      // Verify final state
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as any;
      const test = sqlite.prepare('SELECT * FROM quality_tests WHERE lot_id = 1').get() as any;

      expect(lot.status).toBe('released');
      expect(test.status).toBe('pass');
      expect(test.approved_by).toBe(1);
    });

    it('should reject lot with failed test and create deviation', () => {
      // 1. Receive material
      sqlite.exec(`
        INSERT INTO inventory_lots (id, item_id, lot_number, quantity, unit, status, warehouse_id, received_date, expiry_date)
        VALUES (1, 1, 'LOT-REJ-001', 100, 'kg', 'quarantine', 2, date('now'), date('now', '+730 days'))
      `);

      // 2. Create spec and failing test
      sqlite.exec(`
        INSERT INTO quality_specs (id, item_id, test_name, min_value, max_value, unit, is_critical, is_active)
        VALUES (1, 1, 'Andrographolide', 1, NULL, '%', 1, 1)
      `);

      sqlite.exec(`
        INSERT INTO quality_tests (lot_id, spec_id, test_type, numeric_result, status, tested_by)
        VALUES (1, 1, 'incoming', 0.5, 'fail', 2)
      `);

      // 3. Create OOS deviation
      sqlite.exec(`
        INSERT INTO deviations (deviation_number, title, description, source_type, source_id, severity, status, reported_by)
        VALUES ('DEV-OOS-001', 'OOS: Andrographolide', 'Result 0.5% below min 1%', 'quality', 1, 'major', 'open', 2)
      `);

      // 4. Reject lot
      sqlite.exec(`
        UPDATE inventory_lots SET status = 'rejected' WHERE id = 1
      `);

      // Verify rejection
      const lot = sqlite.prepare('SELECT * FROM inventory_lots WHERE id = 1').get() as any;
      const dev = sqlite.prepare('SELECT * FROM deviations WHERE source_id = 1').get() as any;

      expect(lot.status).toBe('rejected');
      expect(dev.severity).toBe('major');
      expect(dev.status).toBe('open');
    });

    it('should track complete deviation lifecycle', () => {
      // Create deviation
      sqlite.exec(`
        INSERT INTO deviations (deviation_number, title, description, source_type, severity, status, reported_by)
        VALUES ('DEV-LC-001', 'Lifecycle Test', 'Test deviation', 'quality', 'major', 'open', 2)
      `);

      // Investigate
      sqlite.exec(`
        UPDATE deviations SET
          status = 'investigating',
          root_cause = 'Root cause identified',
          assigned_to = 1
        WHERE deviation_number = 'DEV-LC-001'
      `);

      // Add CAPA
      sqlite.exec(`
        UPDATE deviations SET
          corrective_action = 'Corrective action implemented',
          preventive_action = 'Preventive action defined'
        WHERE deviation_number = 'DEV-LC-001'
      `);

      // Close
      sqlite.exec(`
        UPDATE deviations SET
          status = 'closed',
          closed_by = 1,
          closed_at = datetime('now')
        WHERE deviation_number = 'DEV-LC-001'
      `);

      const dev = sqlite.prepare('SELECT * FROM deviations WHERE deviation_number = ?').get('DEV-LC-001') as any;

      expect(dev.status).toBe('closed');
      expect(dev.root_cause).toBeTruthy();
      expect(dev.corrective_action).toBeTruthy();
      expect(dev.preventive_action).toBeTruthy();
      expect(dev.closed_by).toBe(1);
    });
  });
});
