/**
 * Complaint Service Integration Tests
 * Feature: 014-unit-cost
 *
 * Tests execute real database queries against SQLite to catch schema mismatch bugs.
 * Focus: Verify all SQL queries work without schema errors.
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

// Mock the database module BEFORE importing the service
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../../helpers/test-db';
import { seedTestUser, seedComplaintsData } from '../../../helpers/service-test-seeds';

// Now import the service (after mock is set up)
import {
  generateComplaintNumber,
  listComplaints,
  getComplaintById,
  getComplaintDetails,
  createComplaint,
  updateComplaint,
  getComplaintDashboard,
} from '@/lib/services/complaint-service';

describe('Complaint Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteItems,
      schema.sqliteWarehouses,
      schema.sqliteWarehouseLocations,
      schema.sqliteInventoryLots,
      schema.sqliteComplaints,
      schema.sqliteComplaintInvestigations,
      schema.sqliteCapa,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    // Clean tables before each test (in FK order)
    cleanTables(sqlite, [
      'complaint_investigations',
      'complaints',
      'capa',
      'inventory_lots',
      'warehouse_locations',
      'warehouses',
      'items',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  describe('generateComplaintNumber', () => {
    it('should generate complaint number without schema errors', async () => {
      const number = await generateComplaintNumber();

      expect(number).toBeDefined();
      expect(typeof number).toBe('string');
      expect(number).toMatch(/^COMP-\d{4}-\d{4}$/);
    });
  });

  describe('listComplaints', () => {
    it('should query without schema errors', async () => {
      seedComplaintsData(sqlite);

      const result = await listComplaints({});

      expect(result).toBeDefined();
      expect(result.complaints).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });

    it('should return paginated results', async () => {
      seedComplaintsData(sqlite);

      const result = await listComplaints({ page: 1, limit: 2 });

      expect(result.complaints.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      seedComplaintsData(sqlite);

      const result = await listComplaints({ status: 'received' });

      expect(result.complaints.every(c => c.status === 'received')).toBe(true);
    });

    it('should filter by severity', async () => {
      seedComplaintsData(sqlite);

      const result = await listComplaints({ severity: 'major' });

      expect(result.complaints.every(c => c.severity === 'major')).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await listComplaints({ status: 'closed' });

      expect(result.complaints).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getComplaintById', () => {
    it('should query without schema errors', async () => {
      seedComplaintsData(sqlite);

      const complaint = await getComplaintById(1);

      expect(complaint).toBeDefined();
      expect(complaint?.id).toBe(1);
    });

    it('should return null for non-existent complaint', async () => {
      const complaint = await getComplaintById(99999);

      expect(complaint).toBeNull();
    });

    it('should return all complaint fields', async () => {
      seedComplaintsData(sqlite);

      const complaint = await getComplaintById(1);

      expect(complaint).toHaveProperty('complaintNumber');
      expect(complaint).toHaveProperty('source');
      expect(complaint).toHaveProperty('category');
      expect(complaint).toHaveProperty('severity');
      expect(complaint).toHaveProperty('status');
    });
  });

  describe('getComplaintDetails', () => {
    it('should query with joins without schema errors', async () => {
      seedComplaintsData(sqlite);

      const details = await getComplaintDetails(1);

      expect(details).toBeDefined();
      expect(details?.id).toBeDefined();
    });

    it('should return null for non-existent complaint', async () => {
      const details = await getComplaintDetails(99999);

      expect(details).toBeNull();
    });
  });

  describe('createComplaint', () => {
    it('should insert without schema errors', async () => {
      seedComplaintsData(sqlite); // Seeds items for productId

      const complaint = await createComplaint({
        source: 'customer',
        customerName: 'Test Customer',
        productId: 1,
        category: 'quality',
        severity: 'major',
        description: 'Test complaint description',
        receivedDate: '2024-01-15',
      }, 1);

      expect(complaint).toBeDefined();
      expect(complaint.id).toBeGreaterThan(0);
    });

    it('should set initial status to received', async () => {
      seedComplaintsData(sqlite);

      const complaint = await createComplaint({
        source: 'distributor',
        productId: 1,
        category: 'packaging',
        severity: 'minor',
        description: 'Damaged packaging',
        receivedDate: '2024-01-15',
      }, 1);

      expect(complaint.status).toBe('received');
    });

    it('should generate complaint number automatically', async () => {
      seedComplaintsData(sqlite);

      const complaint = await createComplaint({
        source: 'internal',
        productId: 1,
        category: 'labeling',
        severity: 'minor',
        description: 'Label mismatch',
        receivedDate: '2024-01-15',
      }, 1);

      expect(complaint.complaintNumber).toMatch(/^COMP-\d{4}-\d{4}$/);
    });
  });

  describe('updateComplaint', () => {
    it('should update without schema errors', async () => {
      seedComplaintsData(sqlite);

      const updated = await updateComplaint(1, {
        severity: 'critical',
      }, 1);

      expect(updated.severity).toBe('critical');
    });

    it('should preserve unchanged fields', async () => {
      seedComplaintsData(sqlite);
      const original = await getComplaintById(1);

      const updated = await updateComplaint(1, { severity: 'critical' }, 1);

      expect(updated.source).toBe(original?.source);
    });
  });

  describe('getComplaintDashboard', () => {
    it('should aggregate data without schema errors', async () => {
      seedComplaintsData(sqlite);

      const dashboard = await getComplaintDashboard();

      expect(dashboard).toBeDefined();
      expect(typeof dashboard.totalOpen).toBe('number');
      expect(dashboard.bySeverity).toBeDefined();
      expect(dashboard.byStatus).toBeDefined();
    });

    it('should handle empty database', async () => {
      const dashboard = await getComplaintDashboard();

      expect(dashboard.totalOpen).toBe(0);
    });
  });

  describe('Schema Validation', () => {
    it('should handle all complaint columns correctly', async () => {
      seedComplaintsData(sqlite);

      // This test ensures all column references are valid
      const complaint = await createComplaint({
        source: 'customer',
        customerName: 'Test',
        customerContact: 'test@example.com',
        productId: 1,
        category: 'quality',
        severity: 'major',
        description: 'Schema validation test',
        receivedDate: '2024-01-15',
      }, 1);

      // Verify all expected fields exist
      expect(complaint).toHaveProperty('id');
      expect(complaint).toHaveProperty('complaintNumber');
      expect(complaint).toHaveProperty('source');
      expect(complaint).toHaveProperty('category');
      expect(complaint).toHaveProperty('severity');
      expect(complaint).toHaveProperty('status');
      expect(complaint).toHaveProperty('description');
      expect(complaint).toHaveProperty('receivedDate');
      expect(complaint).toHaveProperty('createdBy');
      expect(complaint).toHaveProperty('createdAt');
      expect(complaint).toHaveProperty('updatedAt');
    });
  });
});
