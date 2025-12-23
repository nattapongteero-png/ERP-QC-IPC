/**
 * Equipment Maintenance Service Real Integration Tests
 * Phase 10: Equipment Enhancement (Tasks T1002-T1007)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Equipment Maintenance functionality with real-world scenarios.
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
// Test Constants
// ============================================
const TEST_USER_IDS = {
  MAINTENANCE_MANAGER: 1,
  CALIBRATION_TECH: 2,
  OPERATOR: 3,
};

const now = new Date();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  YESTERDAY: new Date(now.getTime() - 86400000).toISOString().split('T')[0],
  NEXT_WEEK: new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0],
  TWO_WEEKS: new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0],
  NEXT_MONTH: new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0],
  LAST_MONTH: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0],
  SIX_MONTHS_AGO: new Date(now.getTime() - 180 * 86400000).toISOString().split('T')[0],
  ONE_YEAR_AGO: new Date(now.getTime() - 365 * 86400000).toISOString().split('T')[0],
  ONE_YEAR_AHEAD: new Date(now.getTime() + 365 * 86400000).toISOString().split('T')[0],
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

  for (const [, column] of Object.entries(columns)) {
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
  getEquipmentById,
  getEquipmentList,
  createMaintenanceRecord,
  scheduleCalibration,
  getOverdueCalibrations,
  sendCalibrationAlerts,
  updateEquipmentStatus,
  updateCleaningStatus,
  completeCalibration,
} from '@/lib/services/equipment-maintenance-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteEquipment,
    schema.sqliteMaintenanceRecords,
    schema.sqliteAuditTrail,
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

function seedBaseData() {
  // Create test users
  sqlite.exec(`
    INSERT INTO users (id, name, email, password, role, department, is_active, created_at, updated_at)
    VALUES
      (${TEST_USER_IDS.MAINTENANCE_MANAGER}, 'Maintenance Manager', 'maint@test.com', 'hashed_password', 'maintenance_manager', 'Maintenance', 1, datetime('now'), datetime('now')),
      (${TEST_USER_IDS.CALIBRATION_TECH}, 'Calibration Tech', 'cal@test.com', 'hashed_password', 'technician', 'Quality', 1, datetime('now'), datetime('now')),
      (${TEST_USER_IDS.OPERATOR}, 'Operator', 'op@test.com', 'hashed_password', 'operator', 'Production', 1, datetime('now'), datetime('now'))
  `);
}

// ============================================
// Helper Functions
// ============================================

let equipmentCounter = 1;

function createTestEquipment(overrides = {}) {
  const defaults = {
    code: `EQ-${equipmentCounter++}`,
    name: 'Test Equipment',
    type: 'mixer',
    location: 'Production Floor',
    model: 'MX-2000',
    manufacturer: 'EquipCorp',
    serial_number: 'SN-12345',
    installation_date: TEST_DATES.ONE_YEAR_AGO,
    last_calibration_date: TEST_DATES.SIX_MONTHS_AGO,
    next_calibration_date: TEST_DATES.SIX_MONTHS_AGO,
    cleaning_status: 'clean',
    status: 'active',
    is_active: 1,
    created_at: TEST_DATES.TODAY,
    updated_at: TEST_DATES.TODAY,
  };

  const data = { ...defaults, ...overrides };
  const result = sqlite.prepare(`
    INSERT INTO equipment (
      code, name, type, location, model, manufacturer, serial_number,
      installation_date, last_calibration_date, next_calibration_date,
      cleaning_status, status, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.code,
    data.name,
    data.type,
    data.location,
    data.model,
    data.manufacturer,
    data.serial_number,
    data.installation_date,
    data.last_calibration_date,
    data.next_calibration_date,
    data.cleaning_status,
    data.status,
    data.is_active,
    data.created_at,
    data.updated_at
  );

  return result.lastInsertRowid as number;
}

// ============================================
// Tests
// ============================================

describe('Equipment Maintenance Service - Real Integration Tests', () => {
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
    // Clear equipment and maintenance records before each test
    sqlite.exec('DELETE FROM maintenance_records');
    sqlite.exec('DELETE FROM equipment');
    sqlite.exec('DELETE FROM audit_trail');
    equipmentCounter = 1; // Reset counter for unique codes
  });

  describe('getEquipmentById', () => {
    it('should retrieve equipment by ID with all fields', async () => {
      const equipmentId = createTestEquipment({
        name: 'High-Speed Mixer',
        type: 'mixer',
        cleaning_status: 'clean',
      });

      const equipment = await getEquipmentById(equipmentId);

      expect(equipment).toBeDefined();
      expect(equipment?.id).toBe(equipmentId);
      expect(equipment?.name).toBe('High-Speed Mixer');
      expect(equipment?.type).toBe('mixer');
      expect(equipment?.cleaningStatus).toBe('clean');
      expect(equipment?.status).toBe('active');
    });

    it('should return null for non-existent equipment', async () => {
      const equipment = await getEquipmentById(999999);
      expect(equipment).toBeNull();
    });
  });

  describe('getEquipmentList', () => {
    it('should retrieve all equipment when no filters applied', async () => {
      createTestEquipment({ name: 'Equipment 1' });
      createTestEquipment({ name: 'Equipment 2' });
      createTestEquipment({ name: 'Equipment 3' });

      const equipment = await getEquipmentList();

      expect(equipment).toHaveLength(3);
      expect(equipment.map(e => e.name)).toContain('Equipment 1');
    });

    it('should filter by status', async () => {
      createTestEquipment({ name: 'Active Equipment', status: 'active' });
      createTestEquipment({ name: 'Maintenance Equipment', status: 'maintenance' });
      createTestEquipment({ name: 'Inactive Equipment', status: 'inactive' });

      const activeEquipment = await getEquipmentList({ status: 'active' });

      expect(activeEquipment).toHaveLength(1);
      expect(activeEquipment[0].name).toBe('Active Equipment');
    });

    it('should filter by cleaning status', async () => {
      createTestEquipment({ name: 'Clean Equipment', cleaning_status: 'clean' });
      createTestEquipment({ name: 'Dirty Equipment', cleaning_status: 'dirty' });
      createTestEquipment({ name: 'In Use Equipment', cleaning_status: 'in_use' });

      const dirtyEquipment = await getEquipmentList({ cleaningStatus: 'dirty' });

      expect(dirtyEquipment).toHaveLength(1);
      expect(dirtyEquipment[0].name).toBe('Dirty Equipment');
    });
  });

  describe('T1003: scheduleCalibration', () => {
    it('should create calibration record and update next calibration date', async () => {
      const equipmentId = createTestEquipment({ name: 'Calibration Test Equipment' });

      const result = await scheduleCalibration(
        {
          equipmentId,
          scheduledDate: TEST_DATES.NEXT_WEEK,
          description: 'Quarterly calibration',
          assignedTo: TEST_USER_IDS.CALIBRATION_TECH,
        },
        TEST_USER_IDS.MAINTENANCE_MANAGER
      );

      expect(result).toBeDefined();
      expect(result.type).toBe('calibration');
      expect(result.equipmentId).toBe(equipmentId);
      expect(result.scheduledDate).toBe(TEST_DATES.NEXT_WEEK);
      expect(result.status).toBe('scheduled');

      // Verify equipment was updated
      const equipment = await getEquipmentById(equipmentId);
      expect(equipment?.nextCalibrationDate).toBe(TEST_DATES.NEXT_WEEK);
    });

    it('should throw error for non-existent equipment', async () => {
      await expect(
        scheduleCalibration(
          {
            equipmentId: 999999,
            scheduledDate: TEST_DATES.NEXT_WEEK,
          },
          TEST_USER_IDS.MAINTENANCE_MANAGER
        )
      ).rejects.toThrow('Equipment with ID 999999 not found');
    });
  });

  describe('T1004: getOverdueCalibrations', () => {
    it('should return equipment with overdue calibrations', async () => {
      // Equipment with overdue calibration
      createTestEquipment({
        name: 'Overdue Equipment 1',
        next_calibration_date: TEST_DATES.LAST_MONTH,
      });

      // Equipment due today (not overdue yet)
      createTestEquipment({
        name: 'Due Today Equipment',
        next_calibration_date: TEST_DATES.TODAY,
      });

      // Equipment due in future
      createTestEquipment({
        name: 'Future Equipment',
        next_calibration_date: TEST_DATES.NEXT_MONTH,
      });

      const overdue = await getOverdueCalibrations(0);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].equipmentName).toBe('Overdue Equipment 1');
      expect(overdue[0].daysOverdue).toBeGreaterThan(0);
    });

    it('should return equipment overdue by specific days', async () => {
      // Equipment 10 days overdue
      const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString().split('T')[0];
      createTestEquipment({
        name: 'Equipment 10 days overdue',
        next_calibration_date: tenDaysAgo,
      });

      // Equipment 40 days overdue
      const fortyDaysAgo = new Date(now.getTime() - 40 * 86400000).toISOString().split('T')[0];
      createTestEquipment({
        name: 'Equipment 40 days overdue',
        next_calibration_date: fortyDaysAgo,
      });

      // Get equipment overdue by at least 30 days
      const overdue = await getOverdueCalibrations(30);

      expect(overdue).toHaveLength(1);
      expect(overdue[0].equipmentName).toBe('Equipment 40 days overdue');
    });

    it('should not include inactive equipment', async () => {
      createTestEquipment({
        name: 'Inactive Overdue',
        next_calibration_date: TEST_DATES.LAST_MONTH,
        is_active: 0,
      });

      const overdue = await getOverdueCalibrations(0);

      expect(overdue).toHaveLength(0);
    });
  });

  describe('T1005: sendCalibrationAlerts', () => {
    it('should return equipment needing calibration within 7 days', async () => {
      // Equipment due in 5 days
      const fiveDaysAhead = new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0];
      createTestEquipment({
        name: 'Equipment Due in 5 Days',
        next_calibration_date: fiveDaysAhead,
      });

      // Equipment due in 10 days (outside window)
      const tenDaysAhead = new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0];
      createTestEquipment({
        name: 'Equipment Due in 10 Days',
        next_calibration_date: tenDaysAhead,
      });

      const alerts = await sendCalibrationAlerts(7);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].equipmentName).toBe('Equipment Due in 5 Days');
      expect(alerts[0].daysUntil).toBeGreaterThanOrEqual(4);
      expect(alerts[0].daysUntil).toBeLessThanOrEqual(5);
    });

    it('should use custom daysAhead parameter', async () => {
      const fifteenDaysAhead = new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0];
      createTestEquipment({
        name: 'Equipment Due in 15 Days',
        next_calibration_date: fifteenDaysAhead,
      });

      const alerts = await sendCalibrationAlerts(30);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].equipmentName).toBe('Equipment Due in 15 Days');
    });
  });

  describe('T1006: updateEquipmentStatus', () => {
    it('should update equipment status successfully', async () => {
      const equipmentId = createTestEquipment({
        name: 'Status Test Equipment',
        status: 'active',
      });

      const updated = await updateEquipmentStatus({
        equipmentId,
        newStatus: 'maintenance',
        userId: TEST_USER_IDS.MAINTENANCE_MANAGER,
        reason: 'Scheduled maintenance',
      });

      expect(updated.status).toBe('maintenance');
      expect(updated.name).toBe('Status Test Equipment');
    });

    it('should prevent activating equipment without maintenance', async () => {
      const equipmentId = createTestEquipment({
        name: 'Inactive Equipment',
        status: 'inactive',
      });

      await expect(
        updateEquipmentStatus({
          equipmentId,
          newStatus: 'active',
          userId: TEST_USER_IDS.MAINTENANCE_MANAGER,
        })
      ).rejects.toThrow('Cannot activate equipment without completed maintenance record');
    });

    it('should allow activating equipment with completed maintenance', async () => {
      const equipmentId = createTestEquipment({
        name: 'Equipment with Maintenance',
        status: 'inactive',
      });

      // Create completed maintenance record
      await createMaintenanceRecord(
        {
          equipmentId,
          type: 'corrective',
          description: 'Repair completed',
          completedDate: TEST_DATES.YESTERDAY,
          status: 'completed',
        },
        TEST_USER_IDS.MAINTENANCE_MANAGER
      );

      const updated = await updateEquipmentStatus({
        equipmentId,
        newStatus: 'active',
        userId: TEST_USER_IDS.MAINTENANCE_MANAGER,
      });

      expect(updated.status).toBe('active');
    });
  });

  describe('T1007: updateCleaningStatus', () => {
    it('should update cleaning status successfully', async () => {
      const equipmentId = createTestEquipment({
        name: 'Cleaning Test Equipment',
        cleaning_status: 'clean',
      });

      const updated = await updateCleaningStatus({
        equipmentId,
        cleaningStatus: 'dirty',
        userId: TEST_USER_IDS.OPERATOR,
      });

      expect(updated.cleaningStatus).toBe('dirty');
      expect(updated.name).toBe('Cleaning Test Equipment');
    });

    it('should support all cleaning status values', async () => {
      const equipmentId = createTestEquipment({
        name: 'Multi-Status Equipment',
        cleaning_status: 'clean',
      });

      // Test transitioning through different statuses
      let updated = await updateCleaningStatus({
        equipmentId,
        cleaningStatus: 'in_use',
        userId: TEST_USER_IDS.OPERATOR,
      });
      expect(updated.cleaningStatus).toBe('in_use');

      updated = await updateCleaningStatus({
        equipmentId,
        cleaningStatus: 'dirty',
        userId: TEST_USER_IDS.OPERATOR,
      });
      expect(updated.cleaningStatus).toBe('dirty');

      updated = await updateCleaningStatus({
        equipmentId,
        cleaningStatus: 'clean',
        userId: TEST_USER_IDS.OPERATOR,
      });
      expect(updated.cleaningStatus).toBe('clean');
    });
  });

  describe('completeCalibration', () => {
    it('should update calibration dates with default interval', async () => {
      const equipmentId = createTestEquipment({
        name: 'Calibration Complete Equipment',
        last_calibration_date: TEST_DATES.ONE_YEAR_AGO,
        next_calibration_date: TEST_DATES.YESTERDAY,
      });

      const updated = await completeCalibration({
        equipmentId,
        userId: TEST_USER_IDS.CALIBRATION_TECH,
      });

      expect(updated.lastCalibrationDate).toBe(TEST_DATES.TODAY);
      // Next calibration should be 365 days from today
      const expectedNext = new Date(now.getTime() + 365 * 86400000).toISOString().split('T')[0];
      expect(updated.nextCalibrationDate).toBe(expectedNext);
    });

    it('should use custom calibration interval', async () => {
      const equipmentId = createTestEquipment({
        name: 'Custom Interval Equipment',
      });

      const updated = await completeCalibration({
        equipmentId,
        userId: TEST_USER_IDS.CALIBRATION_TECH,
        calibrationIntervalDays: 180, // 6 months
      });

      expect(updated.lastCalibrationDate).toBe(TEST_DATES.TODAY);
      const expectedNext = new Date(now.getTime() + 180 * 86400000).toISOString().split('T')[0];
      expect(updated.nextCalibrationDate).toBe(expectedNext);
    });
  });

  describe('createMaintenanceRecord', () => {
    it('should create maintenance record with all fields', async () => {
      const equipmentId = createTestEquipment({
        name: 'Maintenance Record Equipment',
      });

      const record = await createMaintenanceRecord(
        {
          equipmentId,
          type: 'preventive',
          description: 'Regular maintenance check',
          scheduledDate: TEST_DATES.TODAY,
          performedBy: TEST_USER_IDS.CALIBRATION_TECH,
          cost: 500.00,
          notes: 'All systems normal',
          status: 'completed',
        },
        TEST_USER_IDS.MAINTENANCE_MANAGER
      );

      expect(record).toBeDefined();
      expect(record.equipmentId).toBe(equipmentId);
      expect(record.type).toBe('preventive');
      expect(record.description).toBe('Regular maintenance check');
      expect(record.cost).toBe(500.00);
      expect(record.status).toBe('completed');
    });

    it('should default status to scheduled when not provided', async () => {
      const equipmentId = createTestEquipment({
        name: 'Default Status Equipment',
      });

      const record = await createMaintenanceRecord(
        {
          equipmentId,
          type: 'corrective',
          description: 'Fix broken part',
        },
        TEST_USER_IDS.MAINTENANCE_MANAGER
      );

      expect(record.status).toBe('scheduled');
    });
  });
});
