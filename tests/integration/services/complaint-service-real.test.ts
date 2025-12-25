/**
 * Complaint Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Complaint module functionality with real-world scenarios.
 *
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

// ============================================
// Test Constants (inline to avoid import issues)
// ============================================
const TEST_USER_IDS = {
  QA_MANAGER: 1,
  PRODUCTION_SUPERVISOR: 2,
  QC_ANALYST: 3,
};

const TEST_PRODUCT_IDS = {
  PRODUCT_A: 1,
  PRODUCT_B: 2,
};

const TEST_LOT_IDS = {
  LOT_A: 1,
  LOT_B: 2,
};

const now = new Date();
const year = now.getFullYear();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  PAST_DATE: `${year - 1}-06-15`,
  FUTURE_DATE: `${year + 1}-06-15`,
};

const COMPLAINT_TEMPLATE = {
  receivedDate: TEST_DATES.TODAY,
  source: 'customer' as const,
  customerName: 'Test Customer',
  customerContact: 'customer@test.com',
  productId: TEST_PRODUCT_IDS.PRODUCT_A,
  lotId: TEST_LOT_IDS.LOT_A,
  category: 'quality' as const,
  severity: 'major' as const,
  description: 'Test complaint description',
};

// ============================================
// Schema Sync Helper (inline)
// ============================================
interface DrizzleColumnMeta {
  name: string;
  dataType: string;
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

  for (const [key, column] of Object.entries(columns)) {
    const col = column as unknown as DrizzleColumnMeta;
    let def = `"${col.name}" `;

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
      if (defaultVal !== null && typeof defaultVal !== 'function') {
        def += ` DEFAULT ${defaultVal}`;
      }
    }

    if (col.isUnique && !col.primary) {
      def += ' UNIQUE';
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefs.join(',\n  ')}\n)`;
}

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
  generateComplaintNumber,
  listComplaints,
  getComplaintById,
  getComplaintDetails,
  createComplaint,
  updateComplaint,
  routeToQC,
  recordInvestigation,
  closeComplaint,
  linkCapa,
  getComplaintTrends,
  getComplaintDashboard,
} from '@/lib/services/complaint-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteWarehouses,
    schema.sqliteItems,
    schema.sqliteInventoryLots,
    schema.sqliteComplaints,
    schema.sqliteComplaintInvestigations,
    schema.sqliteCapa,
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

describe('Complaint Service Real Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up test environment...');
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Use schema-sync to create tables from Drizzle schema
    syncSchemaFromDrizzle();
    seedTestData();
  });

  afterAll(() => {
    console.log('Cleaning up test environment...');
    sqlite.close();
  });

  beforeEach(() => {
    // Clean complaint-related data before each test
    cleanComplaintTables();
    seedTestData();
  });

  function cleanComplaintTables() {
    sqlite.exec('DELETE FROM complaint_investigations');
    sqlite.exec('DELETE FROM complaints');
    sqlite.exec('DELETE FROM capa');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    // Create test users
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, 'Production Supervisor', 'prod@test.com', 'hash123', 'supervisor', 1),
        (${TEST_USER_IDS.QC_ANALYST}, 'QC Analyst', 'qc@test.com', 'hash123', 'analyst', 1)
    `);

    // Create test warehouse
    sqlite.exec(`
      INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active)
      VALUES
        (1, 'WH-001', 'Main Warehouse', 'finished_goods', 1)
    `);

    // Create test items (products) - matching actual schema
    sqlite.exec(`
      INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active)
      VALUES
        (${TEST_PRODUCT_IDS.PRODUCT_A}, 'PROD-001', 'สมุนไพรทดสอบ A', 'Herbal Test A', 'finished_product', 'capsule', 'box', 1),
        (${TEST_PRODUCT_IDS.PRODUCT_B}, 'PROD-002', 'สมุนไพรทดสอบ B', 'Herbal Test B', 'finished_product', 'liquid', 'bottle', 1)
    `);

    // Create test inventory lots - matching actual schema
    sqlite.exec(`
      INSERT OR IGNORE INTO inventory_lots (id, lot_number, item_id, warehouse_id, quantity, unit, status, expiry_date, manufacturing_date)
      VALUES
        (${TEST_LOT_IDS.LOT_A}, 'LOT-2501-0001', ${TEST_PRODUCT_IDS.PRODUCT_A}, 1, 1000, 'box', 'released', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.PAST_DATE}'),
        (${TEST_LOT_IDS.LOT_B}, 'LOT-2501-0002', ${TEST_PRODUCT_IDS.PRODUCT_B}, 1, 500, 'bottle', 'released', '${TEST_DATES.FUTURE_DATE}', '${TEST_DATES.PAST_DATE}')
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Customer Complaint Lifecycle (receive -> investigate -> close)', () => {
    it('should handle complete complaint workflow from receipt to closure', async () => {
      // Step 1: Receive complaint from customer
      const complaint = await createComplaint({
        receivedDate: TEST_DATES.TODAY,
        source: 'customer',
        customerName: 'Test Customer Co., Ltd.',
        customerContact: 'contact@customer.com',
        productId: TEST_PRODUCT_IDS.PRODUCT_A,
        lotId: TEST_LOT_IDS.LOT_A,
        category: 'quality',
        severity: 'major',
        description: 'Product has unusual color compared to previous batches',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(complaint.id).toBeDefined();
      expect(complaint.complaintNumber).toMatch(/^COMP-\d{4}-\d{4}$/);
      expect(complaint.status).toBe('received');
      expect(complaint.source).toBe('customer');

      // Step 2: Route to QC for investigation
      const investigation = await routeToQC(
        complaint.id,
        TEST_USER_IDS.QC_ANALYST,
        TEST_USER_IDS.QA_MANAGER
      );

      expect(investigation.id).toBeDefined();
      expect(investigation.investigatorId).toBe(TEST_USER_IDS.QC_ANALYST);
      expect(investigation.startDate).toBeDefined();

      // Verify complaint status updated
      const updatedComplaint = await getComplaintById(complaint.id);
      expect(updatedComplaint!.status).toBe('under_investigation');

      // Step 3: Record investigation findings
      const completedInvestigation = await recordInvestigation(
        complaint.id,
        {
          batchRecordReview: 'Reviewed batch record LOT-2501-0001. All parameters within specification.',
          retainSampleTest: 'Tested retain sample - color within acceptable range per specification QC-001.',
          rootCause: 'Natural variation in herb color due to seasonal harvest differences.',
          conclusion: 'Product meets all quality specifications. Color variation is within acceptable limits.',
          recommendation: 'Update customer communication to explain natural variation. Consider adding color range to product label.',
        },
        TEST_USER_IDS.QC_ANALYST
      );

      expect(completedInvestigation.completionDate).toBeDefined();
      expect(completedInvestigation.rootCause).toContain('Natural variation');

      // Verify complaint status is resolved
      const resolvedComplaint = await getComplaintById(complaint.id);
      expect(resolvedComplaint!.status).toBe('resolved');

      // Step 4: Close complaint
      const closedComplaint = await closeComplaint(
        complaint.id,
        'Investigation complete. Product meets specifications.',
        TEST_USER_IDS.QA_MANAGER
      );

      expect(closedComplaint.status).toBe('closed');
      expect(closedComplaint.closedDate).toBeDefined();
      expect(closedComplaint.closedBy).toBe(TEST_USER_IDS.QA_MANAGER);
    });
  });

  describe('Scenario 2: Complaint Escalation to Regulatory Notification', () => {
    it('should handle critical complaint requiring regulatory reporting', async () => {
      // Step 1: Create critical safety complaint
      const complaint = await createComplaint({
        receivedDate: TEST_DATES.TODAY,
        source: 'customer',
        customerName: 'Hospital Pharmacy',
        customerContact: 'pharmacy@hospital.com',
        productId: TEST_PRODUCT_IDS.PRODUCT_A,
        lotId: TEST_LOT_IDS.LOT_A,
        category: 'safety',
        severity: 'critical',
        description: 'Patient reported adverse reaction after taking product. Skin rash and mild swelling.',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(complaint.severity).toBe('critical');
      expect(complaint.category).toBe('safety');

      // Step 2: Update to require regulatory report
      const updatedComplaint = await updateComplaint(
        complaint.id,
        {
          regulatoryReportRequired: true,
          regulatoryReportDate: TEST_DATES.TODAY,
        },
        TEST_USER_IDS.QA_MANAGER
      );

      expect(updatedComplaint.regulatoryReportRequired).toBe(true);
      expect(updatedComplaint.regulatoryReportDate).toBe(TEST_DATES.TODAY);

      // Step 3: Route to QC
      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);

      // Step 4: Complete investigation
      await recordInvestigation(
        complaint.id,
        {
          batchRecordReview: 'Full batch record review completed.',
          retainSampleTest: 'Tested for allergens and contaminants - all within limits.',
          rootCause: 'Patient has known allergy to one of the herbal ingredients (disclosed after incident).',
          conclusion: 'Product formulation is correct. Patient had undisclosed allergy.',
          recommendation: 'Add allergy warning to product label. Report to FDA Thailand as required.',
        },
        TEST_USER_IDS.QC_ANALYST
      );

      // Step 5: Get full details
      const details = await getComplaintDetails(complaint.id);
      expect(details).not.toBeNull();
      expect(details!.investigation).not.toBeNull();
      expect(details!.regulatoryReportRequired).toBe(true);
    });
  });

  describe('Scenario 3: Multiple Complaints - Same Product/Lot', () => {
    it('should track multiple complaints for trend analysis', async () => {
      // Create multiple complaints for same product
      for (let i = 0; i < 3; i++) {
        await createComplaint({
          receivedDate: TEST_DATES.TODAY,
          source: 'customer',
          customerName: `Customer ${i + 1}`,
          productId: TEST_PRODUCT_IDS.PRODUCT_A,
          category: 'packaging',
          severity: 'minor',
          description: `Packaging seal was weak - complaint ${i + 1}`,
        }, TEST_USER_IDS.QA_MANAGER);
      }

      // List complaints filtered by product
      const result = await listComplaints({ productId: TEST_PRODUCT_IDS.PRODUCT_A });
      expect(result.complaints.length).toBe(3);
      expect(result.total).toBe(3);
    });
  });

  // ============================================
  // Service Function Tests
  // ============================================

  describe('generateComplaintNumber()', () => {
    it('should generate unique complaint numbers in sequence', async () => {
      const num1 = await generateComplaintNumber();
      expect(num1).toMatch(/^COMP-\d{4}-0001$/);

      // Create a complaint to increment
      await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      const num2 = await generateComplaintNumber();
      expect(num2).toMatch(/^COMP-\d{4}-0002$/);
    });
  });

  describe('listComplaints()', () => {
    beforeEach(async () => {
      // Create diverse complaints for testing filters
      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'critical',
        category: 'safety',
      }, TEST_USER_IDS.QA_MANAGER);

      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'minor',
        category: 'packaging',
      }, TEST_USER_IDS.QA_MANAGER);
    });

    it('should list all complaints with pagination', async () => {
      const result = await listComplaints({ page: 1, limit: 10 });
      expect(result.complaints.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const result = await listComplaints({ status: 'received' });
      expect(result.complaints.every(c => c.status === 'received')).toBe(true);
    });

    it('should filter by severity', async () => {
      const result = await listComplaints({ severity: 'critical' });
      expect(result.complaints.every(c => c.severity === 'critical')).toBe(true);
    });

    it('should filter by category', async () => {
      const result = await listComplaints({ category: 'safety' });
      expect(result.complaints.every(c => c.category === 'safety')).toBe(true);
    });

    it('should filter by product', async () => {
      const result = await listComplaints({ productId: TEST_PRODUCT_IDS.PRODUCT_A });
      expect(result.complaints.every(c => c.productId === TEST_PRODUCT_IDS.PRODUCT_A)).toBe(true);
    });
  });

  describe('getComplaintById()', () => {
    it('should return complaint by ID', async () => {
      const created = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      const complaint = await getComplaintById(created.id);
      expect(complaint).not.toBeNull();
      expect(complaint!.id).toBe(created.id);
      expect(complaint!.description).toBe(COMPLAINT_TEMPLATE.description);
    });

    it('should return null for non-existent complaint', async () => {
      const complaint = await getComplaintById(99999);
      expect(complaint).toBeNull();
    });
  });

  describe('getComplaintDetails()', () => {
    it('should return complaint with investigation details', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);

      const details = await getComplaintDetails(complaint.id);
      expect(details).not.toBeNull();
      expect(details!.investigation).not.toBeNull();
      expect(details!.investigation!.investigatorId).toBe(TEST_USER_IDS.QC_ANALYST);
    });
  });

  describe('createComplaint()', () => {
    it('should create complaint with all fields', async () => {
      const complaint = await createComplaint({
        receivedDate: TEST_DATES.TODAY,
        source: 'distributor',
        customerName: 'Distributor ABC',
        customerContact: 'sales@distributor.com',
        productId: TEST_PRODUCT_IDS.PRODUCT_B,
        lotId: TEST_LOT_IDS.LOT_B,
        category: 'labeling',
        severity: 'minor',
        description: 'Label text is difficult to read',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(complaint.source).toBe('distributor');
      expect(complaint.category).toBe('labeling');
      expect(complaint.productId).toBe(TEST_PRODUCT_IDS.PRODUCT_B);
      expect(complaint.createdBy).toBe(TEST_USER_IDS.QA_MANAGER);
    });

    it('should create complaint without optional lot', async () => {
      const complaint = await createComplaint({
        receivedDate: TEST_DATES.TODAY,
        source: 'internal',
        productId: TEST_PRODUCT_IDS.PRODUCT_A,
        category: 'other',
        severity: 'minor',
        description: 'Internal quality observation',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(complaint.lotId).toBeNull();
    });
  });

  describe('updateComplaint()', () => {
    it('should update complaint fields', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'minor',
      }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updateComplaint(complaint.id, {
        severity: 'critical',
        regulatoryReportRequired: true,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated.severity).toBe('critical');
      expect(updated.regulatoryReportRequired).toBe(true);
    });

    it('should throw error for non-existent complaint', async () => {
      await expect(updateComplaint(99999, { severity: 'major' }, TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('Complaint not found');
    });
  });

  describe('routeToQC()', () => {
    it('should assign investigator and update status', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      const investigation = await routeToQC(
        complaint.id,
        TEST_USER_IDS.QC_ANALYST,
        TEST_USER_IDS.QA_MANAGER
      );

      expect(investigation.investigatorId).toBe(TEST_USER_IDS.QC_ANALYST);

      const updated = await getComplaintById(complaint.id);
      expect(updated!.status).toBe('under_investigation');
    });

    it('should throw error for non-existent complaint', async () => {
      await expect(routeToQC(99999, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('Complaint not found');
    });

    it('should throw error if already under investigation', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);

      await expect(routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('already under investigation');
    });
  });

  describe('recordInvestigation()', () => {
    it('should record findings and update status', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);

      const investigation = await recordInvestigation(complaint.id, {
        rootCause: 'Material variation',
        conclusion: 'Within specifications',
      }, TEST_USER_IDS.QC_ANALYST);

      expect(investigation.rootCause).toBe('Material variation');
      expect(investigation.completionDate).toBeDefined();

      const updated = await getComplaintById(complaint.id);
      expect(updated!.status).toBe('resolved');
    });

    it('should throw error if investigation not started', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await expect(recordInvestigation(complaint.id, {
        rootCause: 'Test',
        conclusion: 'Test',
      }, TEST_USER_IDS.QC_ANALYST)).rejects.toThrow('route to QC first');
    });
  });

  describe('closeComplaint()', () => {
    it('should close complaint with completed investigation', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);
      await recordInvestigation(complaint.id, {
        rootCause: 'Test',
        conclusion: 'Resolved',
      }, TEST_USER_IDS.QC_ANALYST);

      const closed = await closeComplaint(complaint.id, 'Closed after investigation', TEST_USER_IDS.QA_MANAGER);

      expect(closed.status).toBe('closed');
      expect(closed.closedDate).toBeDefined();
    });

    it('should throw error if investigation not complete', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await expect(closeComplaint(complaint.id, 'Try to close', TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('Investigation not complete');
    });

    it('should throw error if already closed', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);
      await recordInvestigation(complaint.id, {
        rootCause: 'Test',
        conclusion: 'Done',
      }, TEST_USER_IDS.QC_ANALYST);
      await closeComplaint(complaint.id, 'Closed', TEST_USER_IDS.QA_MANAGER);

      await expect(closeComplaint(complaint.id, 'Try again', TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('already closed');
    });
  });

  describe('linkCapa()', () => {
    it('should link CAPA to complaint', async () => {
      // Create a CAPA first
      sqlite.exec(`
        INSERT INTO capa (id, capa_number, title, source_type, type, priority, status, owner_id, due_date)
        VALUES (1, 'CAPA-2501-0001', 'CAPA for Complaint', 'complaint', 'corrective', 'high', 'open', ${TEST_USER_IDS.QA_MANAGER}, '${TEST_DATES.FUTURE_DATE}')
      `);

      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      const updated = await linkCapa(complaint.id, 1, TEST_USER_IDS.QA_MANAGER);

      expect(updated.capaId).toBe(1);
    });
  });

  describe('getComplaintTrends()', () => {
    beforeEach(async () => {
      // Create complaints across different categories
      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        category: 'quality',
      }, TEST_USER_IDS.QA_MANAGER);

      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        category: 'packaging',
      }, TEST_USER_IDS.QA_MANAGER);

      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        category: 'quality',
      }, TEST_USER_IDS.QA_MANAGER);
    });

    it('should return trends by category', async () => {
      const trends = await getComplaintTrends({ period: 'month' });

      expect(trends.byCategory).toBeDefined();
      expect(trends.byCategory.quality).toBeGreaterThanOrEqual(2);
      expect(trends.byCategory.packaging).toBeGreaterThanOrEqual(1);
    });

    it('should return trends by product', async () => {
      const trends = await getComplaintTrends({ period: 'month' });

      expect(trends.byProduct).toBeDefined();
      expect(trends.byProduct.length).toBeGreaterThan(0);
    });
  });

  describe('getComplaintDashboard()', () => {
    beforeEach(async () => {
      // Create complaints with different severities
      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'critical',
      }, TEST_USER_IDS.QA_MANAGER);

      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'major',
      }, TEST_USER_IDS.QA_MANAGER);

      await createComplaint({
        ...COMPLAINT_TEMPLATE,
        severity: 'minor',
      }, TEST_USER_IDS.QA_MANAGER);
    });

    it('should return dashboard statistics', async () => {
      const dashboard = await getComplaintDashboard();

      expect(dashboard.totalOpen).toBeGreaterThanOrEqual(3);
      expect(dashboard.byStatus.received).toBeGreaterThanOrEqual(3);
      expect(dashboard.bySeverity.critical).toBeGreaterThanOrEqual(1);
      expect(dashboard.bySeverity.major).toBeGreaterThanOrEqual(1);
      expect(dashboard.bySeverity.minor).toBeGreaterThanOrEqual(1);
    });

    it('should count critical complaints', async () => {
      const dashboard = await getComplaintDashboard();

      expect(dashboard.criticalCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should return empty list when no complaints exist', async () => {
      // Clean all complaints
      sqlite.exec('DELETE FROM complaint_investigations');
      sqlite.exec('DELETE FROM complaints');

      const result = await listComplaints();
      expect(result.complaints.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle complaint without customer contact', async () => {
      const complaint = await createComplaint({
        receivedDate: TEST_DATES.TODAY,
        source: 'internal',
        productId: TEST_PRODUCT_IDS.PRODUCT_A,
        category: 'quality',
        severity: 'minor',
        description: 'Internal observation',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(complaint.customerName).toBeNull();
      expect(complaint.customerContact).toBeNull();
    });

    it('should handle all severity levels', async () => {
      for (const severity of ['minor', 'major', 'critical'] as const) {
        const complaint = await createComplaint({
          ...COMPLAINT_TEMPLATE,
          severity,
        }, TEST_USER_IDS.QA_MANAGER);

        expect(complaint.severity).toBe(severity);
      }
    });

    it('should handle all category types', async () => {
      for (const category of ['quality', 'efficacy', 'safety', 'packaging', 'labeling', 'other'] as const) {
        const complaint = await createComplaint({
          ...COMPLAINT_TEMPLATE,
          category,
        }, TEST_USER_IDS.QA_MANAGER);

        expect(complaint.category).toBe(category);
      }
    });

    it('should handle all source types', async () => {
      for (const source of ['customer', 'distributor', 'internal', 'regulatory'] as const) {
        const complaint = await createComplaint({
          ...COMPLAINT_TEMPLATE,
          source,
        }, TEST_USER_IDS.QA_MANAGER);

        expect(complaint.source).toBe(source);
      }
    });

    it('should handle investigation with optional fields', async () => {
      const complaint = await createComplaint({
        ...COMPLAINT_TEMPLATE,
      }, TEST_USER_IDS.QA_MANAGER);

      await routeToQC(complaint.id, TEST_USER_IDS.QC_ANALYST, TEST_USER_IDS.QA_MANAGER);

      // Record minimal investigation
      const investigation = await recordInvestigation(complaint.id, {
        rootCause: 'Unknown',
        conclusion: 'Inconclusive',
      }, TEST_USER_IDS.QC_ANALYST);

      expect(investigation.batchRecordReview).toBeNull();
      expect(investigation.retainSampleTest).toBeNull();
      expect(investigation.recommendation).toBeNull();
    });
  });
});
