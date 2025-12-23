/**
 * Sanitation Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Sanitation module functionality with real-world scenarios.
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
  SANITATION_SUPERVISOR: 2,
  OPERATOR: 3,
  VERIFIER: 4,
};

const now = new Date();
const year = now.getFullYear();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  PAST_DATE: `${year - 1}-06-15`,
  FUTURE_DATE: `${year}-12-31`,
  YESTERDAY: new Date(now.getTime() - 86400000).toISOString().split('T')[0],
  NEXT_WEEK: new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0],
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
  getSanitationSchedules,
  getSanitationScheduleById,
  createSanitationSchedule,
  updateSanitationSchedule,
  deleteSanitationSchedule,
  getSanitationLogs,
  getSanitationLogById,
  createSanitationLog,
  updateSanitationLog,
  verifySanitationLog,
  getPestControlLogs,
  getPestControlLogById,
  createPestControlLog,
  updatePestControlLog,
  verifyPestControlLog,
  getPendingTasks,
  getSanitationTrends,
} from '@/lib/services/sanitation-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteSanitationSchedules,
    schema.sqliteSanitationLogs,
    schema.sqlitePestControlLogs,
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

describe('Sanitation Service Real Integration Tests', () => {
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
    // Clean sanitation-related data before each test
    cleanSanitationTables();
    seedBaseData();
  });

  function cleanSanitationTables() {
    sqlite.exec('DELETE FROM pest_control_logs');
    sqlite.exec('DELETE FROM sanitation_logs');
    sqlite.exec('DELETE FROM sanitation_schedules');
    sqlite.exec('DELETE FROM users');
  }

  function seedBaseData() {
    // Create test users
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1),
        (${TEST_USER_IDS.SANITATION_SUPERVISOR}, 'Sanitation Supervisor', 'sanitation@test.com', 'hash123', 'supervisor', 1),
        (${TEST_USER_IDS.OPERATOR}, 'Operator', 'operator@test.com', 'hash123', 'operator', 1),
        (${TEST_USER_IDS.VERIFIER}, 'Verifier', 'verifier@test.com', 'hash123', 'qa_specialist', 1)
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Complete Sanitation Cycle', () => {
    it('should execute full sanitation workflow: schedule -> perform -> verify', async () => {
      // Step 1: Create a sanitation schedule
      const schedule = await createSanitationSchedule({
        name: 'Daily Production Area Cleaning',
        areaType: 'production',
        frequency: 'daily',
        method: 'Wet mopping with approved disinfectant, followed by dry mopping',
        verificationRequired: true,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Daily Production Area Cleaning');
      expect(schedule.frequency).toBe('daily');
      expect(schedule.verificationRequired).toBe(true);

      // Step 2: Record sanitation log
      const log = await createSanitationLog({
        scheduleId: schedule.id,
        scheduledDate: TEST_DATES.TODAY,
        performedDate: TEST_DATES.TODAY,
        method: 'Wet mopping with approved disinfectant',
        chemicalsUsed: 'Chlorine-based disinfectant 1:100 dilution',
        status: 'completed',
        notes: 'All areas cleaned thoroughly',
      }, TEST_USER_IDS.OPERATOR);

      expect(log.id).toBeDefined();
      expect(log.status).toBe('completed');
      expect(log.performedBy).toBe(TEST_USER_IDS.OPERATOR);

      // Step 3: Verify the sanitation
      const verified = await verifySanitationLog(log.id, TEST_USER_IDS.VERIFIER);

      expect(verified?.verifiedBy).toBe(TEST_USER_IDS.VERIFIER);
      expect(verified?.verifiedAt).toBeDefined();

      // Step 4: Check schedule shows last completed
      const updatedSchedule = await getSanitationScheduleById(schedule.id);
      expect(updatedSchedule?.lastCompleted).toBe(TEST_DATES.TODAY);
    });
  });

  describe('Scenario 2: Pest Control Service Visit', () => {
    it('should record pest control inspection with findings', async () => {
      // Step 1: Record pest control visit
      const pestLog = await createPestControlLog({
        serviceDate: TEST_DATES.TODAY,
        contractorName: 'GMP Pest Control Services Ltd.',
        technicianName: 'Mr. Smith',
        serviceType: 'routine',
        areasServiced: ['production', 'warehouse', 'lab'],
        treatmentMethod: 'Bait stations inspection and UV fly trap maintenance',
        findingsCount: 2,
        findings: 'Minor insect activity near loading dock. One damaged bait station in warehouse.',
        recommendations: 'Repair door seal at loading dock. Replace damaged bait station.',
        followUpRequired: true,
        followUpDate: TEST_DATES.NEXT_WEEK,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(pestLog.id).toBeDefined();
      expect(pestLog.serviceType).toBe('routine');
      expect(pestLog.findingsCount).toBe(2);
      expect(pestLog.followUpRequired).toBe(true);

      // Step 2: Verify the pest control log
      const verified = await verifyPestControlLog(pestLog.id, TEST_USER_IDS.QA_MANAGER);
      expect(verified?.verifiedBy).toBe(TEST_USER_IDS.QA_MANAGER);
    });
  });

  describe('Scenario 3: Tracking Overdue Sanitation', () => {
    it('should identify overdue and upcoming tasks', async () => {
      // Create schedules
      await createSanitationSchedule({
        name: 'Weekly Equipment Cleaning',
        areaType: 'production',
        frequency: 'weekly',
        dayOfWeek: (new Date().getDay() + 6) % 7, // Yesterday's day of week
        method: 'Steam cleaning',
        verificationRequired: true,
      }, TEST_USER_IDS.QA_MANAGER);

      const pendingTasks = await getPendingTasks(7);

      // Should return the pending task
      expect(pendingTasks).toBeDefined();
      expect(Array.isArray(pendingTasks)).toBe(true);
    });
  });

  // ============================================
  // Schedule CRUD Tests
  // ============================================

  describe('Sanitation Schedule Management', () => {
    it('should create schedule with all fields', async () => {
      const schedule = await createSanitationSchedule({
        name: 'Monthly Deep Clean',
        areaType: 'warehouse',
        frequency: 'monthly',
        dayOfMonth: 15,
        method: 'High-pressure steam cleaning with detergent',
        verificationRequired: true,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(schedule.id).toBeDefined();
      expect(schedule.name).toBe('Monthly Deep Clean');
      expect(schedule.areaType).toBe('warehouse');
      expect(schedule.frequency).toBe('monthly');
      expect(schedule.dayOfMonth).toBe(15);
      expect(schedule.isActive).toBe(true);
    });

    it('should list schedules with filters', async () => {
      await createSanitationSchedule({
        name: 'Production Daily',
        areaType: 'production',
        frequency: 'daily',
        method: 'Standard cleaning',
      }, TEST_USER_IDS.QA_MANAGER);

      await createSanitationSchedule({
        name: 'Lab Weekly',
        areaType: 'lab',
        frequency: 'weekly',
        dayOfWeek: 1,
        method: 'Sterile cleaning',
      }, TEST_USER_IDS.QA_MANAGER);

      // Filter by area type
      const productionSchedules = await getSanitationSchedules({ areaType: 'production' });
      expect(productionSchedules.length).toBe(1);
      expect(productionSchedules[0].name).toBe('Production Daily');

      // Filter by frequency
      const weeklySchedules = await getSanitationSchedules({ frequency: 'weekly' });
      expect(weeklySchedules.length).toBe(1);
      expect(weeklySchedules[0].name).toBe('Lab Weekly');
    });

    it('should update schedule details', async () => {
      const schedule = await createSanitationSchedule({
        name: 'Original Name',
        areaType: 'office',
        frequency: 'daily',
        method: 'Basic cleaning',
      }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updateSanitationSchedule(schedule.id, {
        name: 'Updated Name',
        method: 'Enhanced cleaning procedure',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated?.name).toBe('Updated Name');
      expect(updated?.method).toBe('Enhanced cleaning procedure');
    });

    it('should deactivate schedule', async () => {
      const schedule = await createSanitationSchedule({
        name: 'Temporary Schedule',
        areaType: 'production',
        frequency: 'daily',
        method: 'Test',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(schedule.isActive).toBe(true);

      const deleted = await deleteSanitationSchedule(schedule.id, TEST_USER_IDS.QA_MANAGER);
      expect(deleted).toBe(true);

      const retrieved = await getSanitationScheduleById(schedule.id);
      expect(retrieved?.isActive).toBe(false);
    });

    it('should get schedule by ID', async () => {
      const created = await createSanitationSchedule({
        name: 'Test Schedule',
        areaType: 'production',
        frequency: 'daily',
        method: 'Test method',
      }, TEST_USER_IDS.QA_MANAGER);

      const retrieved = await getSanitationScheduleById(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.name).toBe('Test Schedule');
    });
  });

  // ============================================
  // Sanitation Log Tests
  // ============================================

  describe('Sanitation Log Management', () => {
    let scheduleId: number;

    beforeEach(async () => {
      const schedule = await createSanitationSchedule({
        name: 'Test Schedule',
        areaType: 'production',
        frequency: 'daily',
        method: 'Standard cleaning',
      }, TEST_USER_IDS.QA_MANAGER);
      scheduleId = schedule.id;
    });

    it('should create log with all details', async () => {
      const log = await createSanitationLog({
        scheduleId,
        scheduledDate: TEST_DATES.TODAY,
        performedDate: TEST_DATES.TODAY,
        method: 'Wet mopping with disinfectant',
        chemicalsUsed: 'Quaternary ammonium compound 1:50',
        status: 'completed',
        notes: 'All surfaces cleaned and disinfected',
      }, TEST_USER_IDS.OPERATOR);

      expect(log.id).toBeDefined();
      expect(log.scheduleId).toBe(scheduleId);
      expect(log.status).toBe('completed');
      expect(log.chemicalsUsed).toBe('Quaternary ammonium compound 1:50');
    });

    it('should list logs with filters', async () => {
      await createSanitationLog({
        scheduleId,
        performedDate: TEST_DATES.TODAY,
        status: 'completed',
      }, TEST_USER_IDS.OPERATOR);

      await createSanitationLog({
        scheduleId,
        performedDate: TEST_DATES.YESTERDAY,
        status: 'missed',
      }, TEST_USER_IDS.OPERATOR);

      // Filter by status
      const completedLogs = await getSanitationLogs({ status: 'completed' });
      expect(completedLogs.logs.length).toBe(1);

      // Filter by schedule
      const allLogs = await getSanitationLogs({ scheduleId });
      expect(allLogs.logs.length).toBe(2);
    });

    it('should update log status', async () => {
      const log = await createSanitationLog({
        scheduleId,
        performedDate: TEST_DATES.TODAY,
        status: 'partial',
        notes: 'Partial cleaning due to maintenance',
      }, TEST_USER_IDS.OPERATOR);

      const updated = await updateSanitationLog(log.id, {
        status: 'completed',
        notes: 'Completed after maintenance finished',
      }, TEST_USER_IDS.OPERATOR);

      expect(updated?.status).toBe('completed');
      expect(updated?.notes).toContain('Completed');
    });

    it('should verify sanitation log', async () => {
      const log = await createSanitationLog({
        scheduleId,
        performedDate: TEST_DATES.TODAY,
        status: 'completed',
      }, TEST_USER_IDS.OPERATOR);

      expect(log.verifiedBy).toBeNull();

      const verified = await verifySanitationLog(log.id, TEST_USER_IDS.VERIFIER);

      expect(verified?.verifiedBy).toBe(TEST_USER_IDS.VERIFIER);
      expect(verified?.verifiedAt).toBeDefined();
    });
  });

  // ============================================
  // Pest Control Tests
  // ============================================

  describe('Pest Control Log Management', () => {
    it('should create pest control log', async () => {
      const log = await createPestControlLog({
        serviceDate: TEST_DATES.TODAY,
        contractorName: 'ABC Pest Control',
        technicianName: 'John Doe',
        serviceType: 'routine',
        areasServiced: ['production', 'warehouse'],
        treatmentMethod: 'Bait station monitoring',
        findingsCount: 0,
        recommendations: 'Continue current program',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(log.id).toBeDefined();
      expect(log.contractorName).toBe('ABC Pest Control');
      expect(log.areasServiced).toEqual(['production', 'warehouse']);
    });

    it('should list pest control logs with filters', async () => {
      await createPestControlLog({
        serviceDate: TEST_DATES.TODAY,
        contractorName: 'ABC Pest Control',
        serviceType: 'routine',
        areasServiced: ['production'],
      }, TEST_USER_IDS.QA_MANAGER);

      await createPestControlLog({
        serviceDate: TEST_DATES.YESTERDAY,
        contractorName: 'ABC Pest Control',
        serviceType: 'emergency',
        areasServiced: ['warehouse'],
        findings: 'Rodent activity detected',
      }, TEST_USER_IDS.QA_MANAGER);

      const routineLogs = await getPestControlLogs({ serviceType: 'routine' });
      expect(routineLogs.logs.length).toBe(1);

      const allLogs = await getPestControlLogs({});
      expect(allLogs.logs.length).toBe(2);
    });

    it('should update pest control log findings', async () => {
      const log = await createPestControlLog({
        serviceDate: TEST_DATES.TODAY,
        contractorName: 'ABC Pest Control',
        serviceType: 'routine',
        areasServiced: ['production'],
        findingsCount: 1,
      }, TEST_USER_IDS.QA_MANAGER);

      const updated = await updatePestControlLog(log.id, {
        findings: 'Minor fly activity near entrance',
        recommendations: 'Install additional UV fly trap',
        followUpRequired: true,
        followUpDate: TEST_DATES.NEXT_WEEK,
      }, TEST_USER_IDS.QA_MANAGER);

      expect(updated?.findings).toContain('fly activity');
      expect(updated?.followUpRequired).toBe(true);
    });

    it('should verify pest control log', async () => {
      const log = await createPestControlLog({
        serviceDate: TEST_DATES.TODAY,
        contractorName: 'ABC Pest Control',
        serviceType: 'routine',
        areasServiced: ['production'],
      }, TEST_USER_IDS.QA_MANAGER);

      expect(log.verifiedBy).toBeNull();

      const verified = await verifyPestControlLog(log.id, TEST_USER_IDS.QA_MANAGER);

      expect(verified?.verifiedBy).toBe(TEST_USER_IDS.QA_MANAGER);
    });
  });

  // ============================================
  // Trends and Statistics Tests
  // ============================================

  describe('Sanitation Trends', () => {
    it('should calculate sanitation trends', async () => {
      // Create schedule and logs
      const schedule = await createSanitationSchedule({
        name: 'Daily Clean',
        areaType: 'production',
        frequency: 'daily',
        method: 'Standard',
      }, TEST_USER_IDS.QA_MANAGER);

      await createSanitationLog({
        scheduleId: schedule.id,
        performedDate: TEST_DATES.TODAY,
        status: 'completed',
      }, TEST_USER_IDS.OPERATOR);

      await createSanitationLog({
        scheduleId: schedule.id,
        performedDate: TEST_DATES.YESTERDAY,
        status: 'completed',
      }, TEST_USER_IDS.OPERATOR);

      const trends = await getSanitationTrends({ period: 'week' });

      expect(trends.period).toBe('week');
      expect(trends.overallComplianceRate).toBeDefined();
      expect(trends.byArea).toBeDefined();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should return null for non-existent schedule', async () => {
      const schedule = await getSanitationScheduleById(99999);
      expect(schedule).toBeNull();
    });

    it('should return null for non-existent log', async () => {
      const log = await getSanitationLogById(99999);
      expect(log).toBeNull();
    });

    it('should return null for non-existent pest control log', async () => {
      const log = await getPestControlLogById(99999);
      expect(log).toBeNull();
    });

    it('should return empty list when no schedules exist', async () => {
      const schedules = await getSanitationSchedules({});
      expect(schedules.length).toBe(0);
    });

    it('should return empty list when no logs exist', async () => {
      const result = await getSanitationLogs({});
      expect(result.logs.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle schedule with no logs', async () => {
      const schedule = await createSanitationSchedule({
        name: 'No Logs Yet',
        areaType: 'lab',
        frequency: 'weekly',
        dayOfWeek: 1,
        method: 'Test',
      }, TEST_USER_IDS.QA_MANAGER);

      expect(schedule.lastCompleted).toBeNull();
      expect(schedule.complianceRate).toBe(100); // 100% assumed if no logs
    });
  });
});
