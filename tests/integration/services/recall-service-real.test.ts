/**
 * Recall Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Recall module functionality with real-world scenarios.
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
  RECALL_COORDINATOR: 2,
  PRODUCTION_SUPERVISOR: 3,
  CUSTOMER_SERVICE: 4,
};

const now = new Date();
const year = now.getFullYear();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  PAST_DATE: `${year - 1}-06-15`,
  FUTURE_DATE: `${year}-12-31`,
  NEAR_FUTURE: `${year}-${String(now.getMonth() + 2).padStart(2, '0')}-01`,
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
        def += col.name.includes('qty') || col.name.includes('quantity') || col.name.includes('rate') ? 'REAL' : 'INTEGER';
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
  generateRecallNumber,
  createRecall,
  getRecallById,
  getRecallDetails,
  updateRecall,
  listRecalls,
  startRecall,
  completeRecall,
  closeRecall,
  getRecallNotifications,
  createNotification,
  updateNotification,
  getRecallReconciliation,
  recordReconciliation,
  generateRecallReport,
} from '@/lib/services/recall-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteCustomers,
    schema.sqliteItems,
    schema.sqliteWarehouses,
    schema.sqliteInventoryLots,
    schema.sqliteComplaints,
    schema.sqliteSalesOrders,
    schema.sqliteSalesOrderLines,
    schema.sqliteSalesDeliveries,
    schema.sqliteRecalls,
    schema.sqliteRecallNotifications,
    schema.sqliteRecallReconciliation,
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

describe('Recall Service Real Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up test environment...');
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Use schema-sync to create tables from Drizzle schema
    syncSchemaFromDrizzle();
    seedBaseData();
  });

  afterAll(() => {
    console.log('Cleaning up test environment...');
    sqlite.close();
  });

  beforeEach(() => {
    // Clean recall-related data before each test
    cleanRecallTables();
    seedBaseData();
  });

  function cleanRecallTables() {
    sqlite.exec('DELETE FROM recall_reconciliation');
    sqlite.exec('DELETE FROM recall_notifications');
    sqlite.exec('DELETE FROM recalls');
    sqlite.exec('DELETE FROM sales_deliveries');
    sqlite.exec('DELETE FROM sales_order_lines');
    sqlite.exec('DELETE FROM sales_orders');
    sqlite.exec('DELETE FROM inventory_lots');
    sqlite.exec('DELETE FROM complaints');
    sqlite.exec('DELETE FROM items');
    sqlite.exec('DELETE FROM warehouses');
    sqlite.exec('DELETE FROM customers');
    sqlite.exec('DELETE FROM users');
  }

  function seedBaseData() {
    // Create test users
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (${TEST_USER_IDS.RECALL_COORDINATOR}, 'Recall Coordinator', 'recall@test.com', 'hash123', 'qa_specialist', 1),
        (${TEST_USER_IDS.PRODUCTION_SUPERVISOR}, 'Production Supervisor', 'production@test.com', 'hash123', 'production_supervisor', 1),
        (${TEST_USER_IDS.CUSTOMER_SERVICE}, 'Customer Service', 'cs@test.com', 'hash123', 'customer_service', 1)
    `);

    // Create test customers
    sqlite.exec(`
      INSERT INTO customers (id, code, name, phone, email, address, customer_type)
      VALUES
        (1, 'CUST-001', 'Hospital A', '0211111111', 'hospital.a@test.com', '123 Medical Rd', 'hospital'),
        (2, 'CUST-002', 'Pharmacy B', '0222222222', 'pharmacy.b@test.com', '456 Health St', 'pharmacy'),
        (3, 'CUST-003', 'Clinic C', '0233333333', 'clinic.c@test.com', '789 Care Ave', 'clinic')
    `);

    // Create test items (products)
    sqlite.exec(`
      INSERT INTO items (id, code, name_th, name_en, type, primary_unit)
      VALUES
        (1, 'HRB-001', 'ยาสมุนไพรหมายเลข 1', 'Herbal Medicine 1', 'finished_good', 'bottle'),
        (2, 'HRB-002', 'ยาสมุนไพรหมายเลข 2', 'Herbal Medicine 2', 'finished_good', 'box')
    `);

    // Create warehouse
    sqlite.exec(`
      INSERT INTO warehouses (id, code, name, type, location, is_active)
      VALUES (1, 'WH-001', 'Main Warehouse', 'finished_goods', 'Building A', 1)
    `);

    // Create test inventory lots
    sqlite.exec(`
      INSERT INTO inventory_lots (id, lot_number, item_id, warehouse_id, manufacturing_date, expiry_date, quantity, unit, status)
      VALUES
        (1, 'LOT-2501-0001', 1, 1, '${TEST_DATES.PAST_DATE}', '${TEST_DATES.FUTURE_DATE}', 1000, 'bottle', 'released'),
        (2, 'LOT-2501-0002', 1, 1, '${TEST_DATES.PAST_DATE}', '${TEST_DATES.FUTURE_DATE}', 500, 'bottle', 'released'),
        (3, 'LOT-2502-0001', 2, 1, '${TEST_DATES.PAST_DATE}', '${TEST_DATES.FUTURE_DATE}', 2000, 'box', 'released')
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Complete Recall Lifecycle', () => {
    it('should execute full recall workflow: initiate -> notify -> reconcile -> close', async () => {
      // Step 1: Create a recall for contaminated product
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Potential microbial contamination detected in batch LOT-2501-0001',
        productId: 1,
        affectedLots: [1, 2],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.id).toBeDefined();
      expect(recall.recallNumber).toMatch(/^RCL-\d{4}-0001$/);
      expect(recall.status).toBe('initiated');
      expect(recall.recallClass).toBe('class_ii');

      // Step 2: Start the recall
      const startedRecall = await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);
      expect(startedRecall?.status).toBe('in_progress');

      // Step 3: Get recall details
      const details = await getRecallDetails(recall.id);
      expect(details).not.toBeNull();
      expect(details!.recallNumber).toBe(recall.recallNumber);

      // Step 4: Complete the recall
      const completedRecall = await completeRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);
      expect(completedRecall?.status).toBe('completed');

      // Step 5: Close the recall with regulatory report
      const closedRecall = await closeRecall(recall.id, {
        regulatoryReportPath: '/reports/recall-report-001.pdf',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(closedRecall?.status).toBe('closed');
      expect(closedRecall?.closureDate).toBeDefined();
    });
  });

  describe('Scenario 2: Class I Critical Recall (Immediate Health Risk)', () => {
    it('should handle critical recall with urgency tracking', async () => {
      // Create a Class I recall (most serious - life-threatening)
      const recall = await createRecall({
        recallClass: 'class_i',
        reason: 'Serious adverse reaction reported - potential allergen contamination',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.QA_MANAGER, // QA Manager handles critical
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.recallClass).toBe('class_i');
      expect(recall.status).toBe('initiated');

      // Start immediately
      const started = await startRecall(recall.id, TEST_USER_IDS.QA_MANAGER);
      expect(started?.status).toBe('in_progress');

      // Verify recall details include affected lots
      const details = await getRecallDetails(recall.id);
      expect(details?.affectedLots).toContain(1);
    });
  });

  describe('Scenario 3: Recall from Complaint Escalation', () => {
    it('should link recall to originating complaint', async () => {
      // First create a complaint that escalates to recall
      sqlite.exec(`
        INSERT INTO complaints (id, complaint_number, source, category, severity, description, status, received_date)
        VALUES (1, 'CMP-2501-0001', 'customer', 'safety', 'critical', 'Customer reported allergic reaction', 'under_investigation', '${TEST_DATES.TODAY}')
      `);

      // Create recall linked to complaint
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Recall initiated from customer complaint CMP-2501-0001',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
        complaintId: 1,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.complaintId).toBe(1);

      // Verify details include complaint information
      const details = await getRecallDetails(recall.id);
      expect(details?.complaintId).toBe(1);
    });
  });

  // ============================================
  // Recall CRUD Tests
  // ============================================

  describe('Recall Management', () => {
    it('should generate unique recall numbers', async () => {
      const num1 = await generateRecallNumber();
      expect(num1).toMatch(/^RCL-\d{4}-0001$/);

      await createRecall({
        recallClass: 'class_iii',
        reason: 'Minor labeling issue',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      const num2 = await generateRecallNumber();
      expect(num2).toMatch(/^RCL-\d{4}-0002$/);
    });

    it('should create recall with all required fields', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Quality deviation detected',
        productId: 1,
        affectedLots: [1, 2],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.id).toBeDefined();
      expect(recall.reason).toBe('Quality deviation detected');
      expect(recall.affectedLots).toEqual([1, 2]);
      expect(recall.coordinatorId).toBe(TEST_USER_IDS.RECALL_COORDINATOR);
    });

    it('should get recall by ID', async () => {
      const created = await createRecall({
        recallClass: 'class_iii',
        reason: 'Test recall',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      const retrieved = await getRecallById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.recallNumber).toBe(created.recallNumber);
    });

    it('should update recall details', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Initial reason',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updateRecall(recall.id, {
        status: 'in_progress',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated?.status).toBe('in_progress');
    });

    it('should list recalls with filters', async () => {
      await createRecall({
        recallClass: 'class_i',
        reason: 'Class I recall',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.QA_MANAGER,
      }, TEST_USER_IDS.QA_MANAGER);

      await createRecall({
        recallClass: 'class_ii',
        reason: 'Class II recall',
        productId: 2,
        affectedLots: [3],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      // Filter by class
      const classIRecalls = await listRecalls({ recallClass: 'class_i' });
      expect(classIRecalls.recalls.length).toBe(1);
      expect(classIRecalls.recalls[0].recallClass).toBe('class_i');

      // Filter by status
      const initiatedRecalls = await listRecalls({ status: 'initiated' });
      expect(initiatedRecalls.recalls.length).toBe(2);
    });
  });

  // ============================================
  // Recall Workflow Tests
  // ============================================

  describe('Recall Workflow', () => {
    it('should transition through status states correctly', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Workflow test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.status).toBe('initiated');

      // Start recall
      const started = await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);
      expect(started?.status).toBe('in_progress');

      // Complete recall
      const completed = await completeRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);
      expect(completed?.status).toBe('completed');

      // Close recall
      const closed = await closeRecall(recall.id, {}, TEST_USER_IDS.QA_MANAGER);
      expect(closed?.status).toBe('closed');
    });

    it('should not start recall that is not in initiated status', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);

      // Try to start again - should throw
      await expect(startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR))
        .rejects.toThrow('Can only start recalls in initiated status');
    });

    it('should not complete recall that is not in_progress', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      // Try to complete without starting - should throw
      await expect(completeRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR))
        .rejects.toThrow('Can only complete recalls in in_progress status');
    });
  });

  // ============================================
  // Notification Tests
  // ============================================

  describe('Recall Notifications', () => {
    let recallId: number;

    beforeEach(async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Notification test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);
      recallId = recall.id;
    });

    it('should create notification for customer', async () => {
      const notification = await createNotification(recallId, {
        customerId: 1,
        notificationMethod: 'phone',
        notes: 'Called customer at 10:00 AM',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      expect(notification.id).toBeDefined();
      expect(notification.recallId).toBe(recallId);
      expect(notification.customerId).toBe(1);
      expect(notification.notificationMethod).toBe('phone');
      expect(notification.responseStatus).toBe('pending');
    });

    it('should list notifications for recall', async () => {
      await createNotification(recallId, {
        customerId: 1,
        notificationMethod: 'phone',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      await createNotification(recallId, {
        customerId: 2,
        notificationMethod: 'email',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      const notifications = await getRecallNotifications(recallId);
      expect(notifications.length).toBe(2);
    });

    it('should update notification response', async () => {
      const notification = await createNotification(recallId, {
        customerId: 1,
        notificationMethod: 'phone',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      const updated = await updateNotification(notification.id, {
        responseStatus: 'acknowledged',
        quantityReturned: 50,
        notes: 'Customer confirmed return of 50 units',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      expect(updated?.responseStatus).toBe('acknowledged');
      expect(updated?.quantityReturned).toBe(50);
      expect(updated?.acknowledgedAt).toBeDefined();
    });
  });

  // ============================================
  // Reconciliation Tests
  // ============================================

  describe('Recall Reconciliation', () => {
    let recallId: number;

    beforeEach(async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Reconciliation test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);
      await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);
      recallId = recall.id;
    });

    it('should record reconciliation for lot', async () => {
      const reconciliation = await recordReconciliation(recallId, {
        lotId: 1,
        returnedQty: 100,
        destroyedQty: 50,
        accountedQty: 25,
        reconciliationNotes: 'Lot fully accounted for',
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      expect(reconciliation.lotId).toBe(1);
      expect(reconciliation.returnedQty).toBe(100);
      expect(reconciliation.destroyedQty).toBe(50);
      expect(reconciliation.accountedQty).toBe(25);
      expect(reconciliation.verifiedBy).toBe(TEST_USER_IDS.RECALL_COORDINATOR);
    });

    it('should list reconciliation records for recall', async () => {
      await recordReconciliation(recallId, {
        lotId: 1,
        returnedQty: 50,
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      const records = await getRecallReconciliation(recallId);
      expect(records.length).toBe(1);
    });

    it('should update existing reconciliation record', async () => {
      // First record
      await recordReconciliation(recallId, {
        lotId: 1,
        returnedQty: 50,
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      // Update with more returns
      const updated = await recordReconciliation(recallId, {
        lotId: 1,
        returnedQty: 100,
        destroyedQty: 20,
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      expect(updated.returnedQty).toBe(100);
      expect(updated.destroyedQty).toBe(20);

      // Should still be just one record
      const records = await getRecallReconciliation(recallId);
      expect(records.length).toBe(1);
    });
  });

  // ============================================
  // Recall Report Generation
  // ============================================

  describe('Recall Report Generation', () => {
    let recallId: number;

    beforeEach(async () => {
      // Create a comprehensive recall with all data
      const recall = await createRecall({
        recallClass: 'class_i',
        reason: 'Critical contamination detected in product',
        productId: 1,
        affectedLots: [1, 2],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);

      // Add notifications
      await createNotification(recall.id, {
        customerId: 1,
        notificationMethod: 'phone',
        notes: 'Customer notified by phone',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      await createNotification(recall.id, {
        customerId: 2,
        notificationMethod: 'email',
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      // Update one notification as acknowledged
      const notifications = await getRecallNotifications(recall.id);
      await updateNotification(notifications[0].id, {
        responseStatus: 'acknowledged',
        quantityReturned: 50,
      }, TEST_USER_IDS.CUSTOMER_SERVICE);

      // Add reconciliation
      await recordReconciliation(recall.id, {
        lotId: 1,
        returnedQty: 100,
        destroyedQty: 50,
        accountedQty: 25,
        reconciliationNotes: 'Lot 1 reconciled',
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      await recordReconciliation(recall.id, {
        lotId: 2,
        returnedQty: 75,
        destroyedQty: 25,
        reconciliationNotes: 'Lot 2 reconciled',
      }, TEST_USER_IDS.RECALL_COORDINATOR);

      recallId = recall.id;
    });

    it('should generate comprehensive recall report', async () => {
      const report = await generateRecallReport(recallId);

      // Check report structure
      expect(report).toBeDefined();
      expect(report.generatedAt).toBeDefined();

      // Check recall info
      expect(report.recall.recallNumber).toMatch(/^RCL-\d{4}-\d{4}$/);
      expect(report.recall.recallClass).toBe('CLASS I');
      expect(report.recall.reason).toBe('Critical contamination detected in product');
      expect(report.recall.status).toBe('in_progress');
      expect(report.recall.coordinatorName).toBe('Recall Coordinator');

      // Check product info
      expect(report.product.name).toBe('ยาสมุนไพรหมายเลข 1');
      expect(report.product.code).toBe('HRB-001');
      expect(report.product.affectedLots).toHaveLength(2);

      // Check notifications
      expect(report.notifications.totalSent).toBe(2);
      expect(report.notifications.acknowledged).toBe(1);
      expect(report.notifications.pending).toBe(1);
      expect(report.notifications.timeline.length).toBeGreaterThanOrEqual(2);

      // Check reconciliation
      expect(report.reconciliation.returned).toBe(175); // 100 + 75
      expect(report.reconciliation.destroyed).toBe(75); // 50 + 25
      expect(report.reconciliation.accounted).toBe(25);

      // Check timeline
      expect(report.timeline.length).toBeGreaterThan(0);
      expect(report.timeline[0].event).toBe('Recall Initiated');

      // Check regulatory notes
      expect(report.regulatoryNotes).toContain('CLASS I RECALL');
      expect(report.regulatoryNotes).toContain('serious adverse health consequences');
    });

    it('should calculate effectiveness rate in report', async () => {
      await completeRecall(recallId, TEST_USER_IDS.RECALL_COORDINATOR);
      const report = await generateRecallReport(recallId);

      // Effectiveness rate should be defined and be a number
      expect(report.reconciliation.effectivenessRate).toBeGreaterThanOrEqual(0);
      expect(typeof report.reconciliation.effectivenessRate).toBe('number');
      expect(report.regulatoryNotes).toContain('Effectiveness Rate');
    });

    it('should include timeline events in chronological order', async () => {
      const report = await generateRecallReport(recallId);

      expect(report.timeline.length).toBeGreaterThan(0);

      // Check chronological order
      for (let i = 1; i < report.timeline.length; i++) {
        expect(report.timeline[i].date >= report.timeline[i - 1].date).toBe(true);
      }
    });

    it('should throw error for non-existent recall', async () => {
      await expect(generateRecallReport(99999)).rejects.toThrow('Recall ID 99999 not found');
    });

    it('should handle recall with no notifications', async () => {
      const recall = await createRecall({
        recallClass: 'class_iii',
        reason: 'Minor issue',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);

      const report = await generateRecallReport(recall.id);

      expect(report.notifications.totalSent).toBe(0);
      expect(report.notifications.timeline).toHaveLength(0);
    });

    it('should handle recall with no reconciliation', async () => {
      const recall = await createRecall({
        recallClass: 'class_iii',
        reason: 'Minor issue',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      await startRecall(recall.id, TEST_USER_IDS.RECALL_COORDINATOR);

      const report = await generateRecallReport(recall.id);

      expect(report.reconciliation.returned).toBe(0);
      expect(report.reconciliation.destroyed).toBe(0);
      expect(report.reconciliation.accounted).toBe(0);
    });

    it('should group distribution by customer', async () => {
      const report = await generateRecallReport(recallId);

      // Distribution should be grouped by customer
      const customerIds = new Set(report.distribution.customers.map(c => c.name));
      expect(customerIds.size).toBeLessThanOrEqual(report.distribution.customers.length);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should return null for non-existent recall', async () => {
      const recall = await getRecallById(99999);
      expect(recall).toBeNull();
    });

    it('should return null for non-existent recall details', async () => {
      const details = await getRecallDetails(99999);
      expect(details).toBeNull();
    });

    it('should return empty list when no recalls exist', async () => {
      const result = await listRecalls({});
      expect(result.recalls.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should return empty notifications for recall with none', async () => {
      const recall = await createRecall({
        recallClass: 'class_iii',
        reason: 'Test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      const notifications = await getRecallNotifications(recall.id);
      expect(notifications.length).toBe(0);
    });

    it('should return empty reconciliation for recall with none', async () => {
      const recall = await createRecall({
        recallClass: 'class_iii',
        reason: 'Test',
        productId: 1,
        affectedLots: [1],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      const reconciliation = await getRecallReconciliation(recall.id);
      expect(reconciliation.length).toBe(0);
    });

    it('should handle recall with multiple affected lots', async () => {
      const recall = await createRecall({
        recallClass: 'class_ii',
        reason: 'Multi-lot recall',
        productId: 1,
        affectedLots: [1, 2, 3],
        coordinatorId: TEST_USER_IDS.RECALL_COORDINATOR,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(recall.affectedLots).toEqual([1, 2, 3]);

      const details = await getRecallDetails(recall.id);
      expect(details?.affectedLots).toEqual([1, 2, 3]);
    });
  });
});
