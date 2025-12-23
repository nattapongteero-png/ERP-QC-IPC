/**
 * CAPA Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete CAPA module functionality with real-world scenarios.
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
  generateCapaNumber,
  listCapas,
  getCapaById,
  getCapaDetails,
  createCapa,
  createFromDeviation,
  updateCapa,
  closeCapa,
  addAction,
  updateAction,
  verifyAction,
  recordEffectiveness,
  getCapaDashboard,
} from '@/lib/services/capa-service';

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
  // Get all SQLite tables from schema
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteCapa,
    schema.sqliteCapaActions,
    schema.sqliteCapaEffectiveness,
    schema.sqliteDeviations,
  ];

  for (const table of tablesToCreate) {
    try {
      const createSql = generateCreateTableSql(table);
      sqlite.exec(createSql);
    } catch (err) {
      // Table might already exist
      console.log(`Table creation note: ${err}`);
    }
  }
}

describe('CAPA Service Real Integration Tests', () => {
  beforeAll(async () => {
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Use schema-sync to create tables from Drizzle schema
    syncSchemaFromDrizzle();
    seedTestData();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    // Clean CAPA-related data before each test
    cleanCapaTables();
    seedTestData();
  });

  function cleanCapaTables() {
    sqlite.exec('DELETE FROM capa_effectiveness');
    sqlite.exec('DELETE FROM capa_actions');
    sqlite.exec('DELETE FROM capa');
    sqlite.exec('DELETE FROM deviations');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    // Create test users (matching Drizzle schema column names)
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (1, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (2, 'Production Supervisor', 'prod@test.com', 'hash123', 'supervisor', 1),
        (3, 'QC Analyst', 'qc@test.com', 'hash123', 'analyst', 1)
    `);

    // Create test deviation
    sqlite.exec(`
      INSERT OR IGNORE INTO deviations (id, deviation_number, title, description, status, severity)
      VALUES (1, 'DEV-2501-0001', 'Temperature excursion in storage area', 'Storage area temperature exceeded 25°C for 2 hours', 'open', 'major')
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Complete CAPA Workflow from Deviation', () => {
    it('should handle full CAPA lifecycle from deviation to closure', async () => {
      // Step 1: Create CAPA from deviation
      const capa = await createCapa({
        title: 'CAPA for Temperature Excursion',
        sourceType: 'deviation',
        sourceId: 1,
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2026-02-01',
        rootCauseAnalysis: '5-Why Analysis: Temperature monitoring system failure',
        rootCauseCategory: 'Equipment Failure',
      }, 1);

      expect(capa.id).toBeDefined();
      expect(capa.capaNumber).toMatch(/^CAPA-\d{4}-\d{4}$/);
      expect(capa.status).toBe('open');
      expect(capa.sourceType).toBe('deviation');

      // Step 2: Add corrective action
      const action1 = await addAction(capa.id, {
        description: 'Replace faulty temperature sensor',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      expect(action1.id).toBeDefined();
      expect(action1.actionNumber).toBe(1);
      expect(action1.status).toBe('pending');

      // Step 3: Add preventive action
      const action2 = await addAction(capa.id, {
        description: 'Implement redundant temperature monitoring',
        actionType: 'preventive',
        assigneeId: 2,
        dueDate: '2026-01-20',
      }, 1);

      expect(action2.actionNumber).toBe(2);

      // Step 4: Complete first action
      const completedAction1 = await updateAction(action1.id, {
        status: 'completed',
        completionNotes: 'Sensor replaced and calibrated',
      }, 2);

      expect(completedAction1.status).toBe('completed');
      expect(completedAction1.completedAt).toBeTruthy();

      // Step 5: Complete second action
      const completedAction2 = await updateAction(action2.id, {
        status: 'completed',
        completionNotes: 'Redundant system installed and tested',
      }, 2);

      expect(completedAction2.status).toBe('completed');

      // Step 6: Verify actions
      const verifiedAction1 = await verifyAction(action1.id, 1);
      expect(verifiedAction1.verifiedBy).toBe(1);
      expect(verifiedAction1.verifiedAt).toBeTruthy();

      const verifiedAction2 = await verifyAction(action2.id, 1);
      expect(verifiedAction2.verifiedBy).toBe(1);

      // Step 7: Record effectiveness
      const effectiveness = await recordEffectiveness(capa.id, {
        criteria: 'No temperature excursions for 30 days',
        result: 'effective',
        evidence: 'Temperature logs reviewed - no excursions',
        followUpRequired: false,
      }, 1);

      expect(effectiveness.result).toBe('effective');
      expect(effectiveness.checkNumber).toBe(1);

      // Step 8: Close CAPA
      const closedCapa = await closeCapa(capa.id, 'All actions completed and verified effective', 1);

      expect(closedCapa.status).toBe('closed');
      expect(closedCapa.closedDate).toBeTruthy();
    });
  });

  describe('Scenario 2: CAPA from Customer Complaint', () => {
    it('should create and manage CAPA from complaint source', async () => {
      const capa = await createCapa({
        title: 'CAPA for Product Quality Complaint',
        sourceType: 'complaint',
        sourceId: 100,
        type: 'both', // Both corrective and preventive
        priority: 'critical',
        ownerId: 1,
        dueDate: '2026-01-30',
      }, 1);

      expect(capa.sourceType).toBe('complaint');
      expect(capa.type).toBe('both');
      expect(capa.priority).toBe('critical');

      // Add immediate action (containment)
      const immediateAction = await addAction(capa.id, {
        description: 'Quarantine affected batch',
        actionType: 'immediate',
        assigneeId: 3,
        dueDate: '2026-01-01',
      }, 1);

      expect(immediateAction.actionType).toBe('immediate');

      // Verify CAPA details include actions
      const details = await getCapaDetails(capa.id);
      expect(details).not.toBeNull();
      expect(details!.actions.length).toBe(1);
    });
  });

  describe('Scenario 3: CAPA from Audit Finding', () => {
    it('should create CAPA from audit finding with preventive focus', async () => {
      const capa = await createCapa({
        title: 'CAPA for Documentation Gap',
        sourceType: 'audit_finding',
        sourceId: 50,
        type: 'preventive',
        priority: 'medium',
        ownerId: 1,
        dueDate: '2026-03-01',
        rootCauseAnalysis: 'Lack of training on documentation requirements',
        rootCauseCategory: 'Human Error',
      }, 1);

      expect(capa.sourceType).toBe('audit_finding');
      expect(capa.type).toBe('preventive');
      expect(capa.rootCauseCategory).toBe('Human Error');
    });
  });

  describe('Scenario 4: Overdue CAPA Management', () => {
    it('should identify and list overdue CAPAs', async () => {
      // Create an overdue CAPA
      const pastDate = '2024-01-01';
      const capa = await createCapa({
        title: 'Overdue CAPA',
        sourceType: 'other',
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: pastDate,
      }, 1);

      // List with overdue filter
      const result = await listCapas({ overdue: true });

      expect(result.capas.length).toBeGreaterThanOrEqual(1);
      const overdueCapa = result.capas.find(c => c.id === capa.id);
      expect(overdueCapa).toBeDefined();
      expect(overdueCapa!.isOverdue).toBe(true);
    });
  });

  describe('Scenario 5: Partial Effectiveness Requiring Follow-up', () => {
    it('should handle partial effectiveness with follow-up', async () => {
      // Create CAPA and complete workflow up to effectiveness
      const capa = await createCapa({
        title: 'CAPA Requiring Follow-up',
        sourceType: 'deviation',
        type: 'corrective',
        priority: 'medium',
        ownerId: 1,
        dueDate: '2026-02-01',
      }, 1);

      const action = await addAction(capa.id, {
        description: 'Implement corrective measure',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      await updateAction(action.id, { status: 'completed', completionNotes: 'Done' }, 2);
      await verifyAction(action.id, 1);

      // Record partial effectiveness
      const partialCheck = await recordEffectiveness(capa.id, {
        criteria: 'Process improvement',
        result: 'partial',
        evidence: 'Some improvement seen, need more time',
        followUpRequired: true,
        notes: 'Schedule 30-day follow-up',
      }, 1);

      expect(partialCheck.result).toBe('partial');
      expect(partialCheck.followUpRequired).toBe(true);

      // Record follow-up effectiveness (now effective)
      const effectiveCheck = await recordEffectiveness(capa.id, {
        criteria: 'Follow-up check after 30 days',
        result: 'effective',
        evidence: 'No recurrence observed',
        followUpRequired: false,
      }, 1);

      expect(effectiveCheck.checkNumber).toBe(2);
      expect(effectiveCheck.result).toBe('effective');

      // Now can close
      const closedCapa = await closeCapa(capa.id, 'Closed after follow-up', 1);
      expect(closedCapa.status).toBe('closed');
    });
  });

  // ============================================
  // Service Function Tests
  // ============================================

  describe('generateCapaNumber()', () => {
    it('should generate unique CAPA numbers in sequence', async () => {
      const num1 = await generateCapaNumber();
      expect(num1).toMatch(/^CAPA-\d{4}-0001$/);

      // Create a CAPA to increment
      await createCapa({
        title: 'Test CAPA',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const num2 = await generateCapaNumber();
      expect(num2).toMatch(/^CAPA-\d{4}-0002$/);
    });
  });

  describe('listCapas()', () => {
    beforeEach(async () => {
      // Create multiple CAPAs for testing filters
      await createCapa({
        title: 'High Priority Open',
        sourceType: 'deviation',
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      await createCapa({
        title: 'Low Priority Closed',
        sourceType: 'complaint',
        type: 'preventive',
        priority: 'low',
        ownerId: 2,
        dueDate: '2026-01-01',
      }, 1);
    });

    it('should list all CAPAs with pagination', async () => {
      const result = await listCapas({ page: 1, limit: 10 });
      expect(result.capas.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const result = await listCapas({ status: 'open' });
      expect(result.capas.every(c => c.status === 'open')).toBe(true);
    });

    it('should filter by priority', async () => {
      const result = await listCapas({ priority: 'high' });
      expect(result.capas.every(c => c.priority === 'high')).toBe(true);
    });

    it('should filter by source type', async () => {
      const result = await listCapas({ sourceType: 'deviation' });
      expect(result.capas.every(c => c.sourceType === 'deviation')).toBe(true);
    });

    it('should filter by owner', async () => {
      const result = await listCapas({ ownerId: 1 });
      expect(result.capas.every(c => c.ownerId === 1)).toBe(true);
    });
  });

  describe('getCapaById()', () => {
    it('should return CAPA by ID', async () => {
      const created = await createCapa({
        title: 'Test CAPA',
        sourceType: 'other',
        type: 'corrective',
        priority: 'medium',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const capa = await getCapaById(created.id);
      expect(capa).not.toBeNull();
      expect(capa!.id).toBe(created.id);
      expect(capa!.title).toBe('Test CAPA');
    });

    it('should return null for non-existent CAPA', async () => {
      const capa = await getCapaById(99999);
      expect(capa).toBeNull();
    });
  });

  describe('getCapaDetails()', () => {
    it('should return CAPA with actions and effectiveness checks', async () => {
      const capa = await createCapa({
        title: 'Detailed CAPA',
        sourceType: 'deviation',
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      await addAction(capa.id, {
        description: 'Action 1',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      const details = await getCapaDetails(capa.id);
      expect(details).not.toBeNull();
      expect(details!.actions.length).toBe(1);
      expect(details!.effectivenessChecks).toBeDefined();
    });
  });

  describe('createFromDeviation()', () => {
    it('should create CAPA linked to deviation', async () => {
      const capa = await createFromDeviation(1, {
        title: 'CAPA from Deviation',
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2026-02-01',
      }, 1);

      expect(capa.sourceType).toBe('deviation');
      expect(capa.deviationId).toBe(1);
    });

    it('should throw error for non-existent deviation', async () => {
      await expect(createFromDeviation(99999, {
        title: 'Invalid',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1)).rejects.toThrow('Deviation not found');
    });
  });

  describe('updateCapa()', () => {
    it('should update CAPA fields', async () => {
      const capa = await createCapa({
        title: 'Original Title',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const updated = await updateCapa(capa.id, {
        title: 'Updated Title',
        priority: 'critical',
        status: 'investigation',
        rootCauseAnalysis: '5-Why completed',
        rootCauseCategory: 'Method Issue',
      }, 1);

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('critical');
      expect(updated.status).toBe('investigation');
    });

    it('should throw error for non-existent CAPA', async () => {
      await expect(updateCapa(99999, { title: 'Test' }, 1)).rejects.toThrow('CAPA not found');
    });
  });

  describe('closeCapa()', () => {
    it('should prevent closing without completed actions', async () => {
      const capa = await createCapa({
        title: 'Cannot Close',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      await addAction(capa.id, {
        description: 'Pending action',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      await expect(closeCapa(capa.id, 'Try to close', 1))
        .rejects.toThrow('action(s) not completed');
    });

    it('should prevent closing without effectiveness check', async () => {
      const capa = await createCapa({
        title: 'No Effectiveness',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const action = await addAction(capa.id, {
        description: 'Complete action',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      await updateAction(action.id, { status: 'completed' }, 2);

      await expect(closeCapa(capa.id, 'Try to close', 1))
        .rejects.toThrow('No effective verification');
    });
  });

  describe('verifyAction()', () => {
    it('should prevent verifying non-completed actions', async () => {
      const capa = await createCapa({
        title: 'Test',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const action = await addAction(capa.id, {
        description: 'Pending',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      await expect(verifyAction(action.id, 1))
        .rejects.toThrow('Can only verify completed actions');
    });
  });

  describe('getCapaDashboard()', () => {
    beforeEach(async () => {
      // Create diverse CAPAs for dashboard
      await createCapa({
        title: 'Open High',
        sourceType: 'deviation',
        type: 'corrective',
        priority: 'high',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      await createCapa({
        title: 'Open Critical',
        sourceType: 'complaint',
        type: 'both',
        priority: 'critical',
        ownerId: 1,
        dueDate: '2024-01-01', // Overdue
      }, 1);
    });

    it('should return dashboard with correct statistics', async () => {
      const dashboard = await getCapaDashboard();

      expect(dashboard.totalOpen).toBeGreaterThanOrEqual(2);
      expect(dashboard.byStatus).toHaveProperty('open');
      expect(dashboard.byPriority).toHaveProperty('high');
      expect(dashboard.byPriority).toHaveProperty('critical');
      expect(dashboard.overdue).toBeGreaterThanOrEqual(1);
      expect(typeof dashboard.avgClosureTime).toBe('number');
      expect(typeof dashboard.effectivenessRate).toBe('number');
    });

    it('should calculate effectiveness rate correctly', async () => {
      // Create a closed CAPA with effectiveness
      const capa = await createCapa({
        title: 'Closed CAPA',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const action = await addAction(capa.id, {
        description: 'Action',
        actionType: 'corrective',
        assigneeId: 2,
        dueDate: '2026-01-15',
      }, 1);

      await updateAction(action.id, { status: 'completed' }, 2);
      await verifyAction(action.id, 1);
      await recordEffectiveness(capa.id, {
        criteria: 'Test',
        result: 'effective',
      }, 1);

      const dashboard = await getCapaDashboard();
      expect(dashboard.effectivenessRate).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle CAPA with no actions', async () => {
      const capa = await createCapa({
        title: 'No Actions CAPA',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      const details = await getCapaDetails(capa.id);
      expect(details!.actions.length).toBe(0);
    });

    it('should handle multiple effectiveness checks', async () => {
      const capa = await createCapa({
        title: 'Multi Check',
        sourceType: 'other',
        type: 'corrective',
        priority: 'low',
        ownerId: 1,
        dueDate: '2026-01-01',
      }, 1);

      await recordEffectiveness(capa.id, { criteria: 'Check 1', result: 'partial' }, 1);
      await recordEffectiveness(capa.id, { criteria: 'Check 2', result: 'partial' }, 1);
      await recordEffectiveness(capa.id, { criteria: 'Check 3', result: 'effective' }, 1);

      const details = await getCapaDetails(capa.id);
      expect(details!.effectivenessChecks.length).toBe(3);
    });

    it('should handle all root cause categories', async () => {
      const categories = [
        'Human Error',
        'Equipment Failure',
        'Material Defect',
        'Method Issue',
        'Environment Factor',
        'Measurement Error',
      ];

      for (const category of categories) {
        const capa = await createCapa({
          title: `CAPA for ${category}`,
          sourceType: 'other',
          type: 'corrective',
          priority: 'low',
          ownerId: 1,
          dueDate: '2026-01-01',
          rootCauseCategory: category,
        }, 1);

        expect(capa.rootCauseCategory).toBe(category);
      }
    });
  });
});
