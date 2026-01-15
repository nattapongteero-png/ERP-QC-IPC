/**
 * Change Control Service Integration Tests
 * Feature: 014-unit-cost
 *
 * Tests execute real database queries against SQLite to catch schema mismatch bugs.
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
import { seedTestUser } from '../../../helpers/service-test-seeds';
import { getSqliteDate, getSqliteDateOffset } from '../../../helpers/service-test-utils';

// Now import the service (after mock is set up)
import {
  generateChangeNumber,
  createChangeRequest,
  getChangeRequestById,
  listChangeRequests,
  updateChangeRequest,
} from '@/lib/services/change-control-service';

describe('Change Control Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteChangeRequests,
      schema.sqliteChangeApprovals,
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
      'change_approvals',
      'change_requests',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helper
  function seedChangeRequests() {
    const changes = [
      { id: 1, number: 'CC-2024-0001', type: 'process', status: 'draft', priority: 'high' },
      { id: 2, number: 'CC-2024-0002', type: 'document', status: 'pending_review', priority: 'medium' },
      { id: 3, number: 'CC-2024-0003', type: 'equipment', status: 'approved', priority: 'low' },
    ];

    for (const change of changes) {
      sqlite.exec(`
        INSERT INTO change_requests (id, change_number, title, change_type, status, priority, requester_id, owner_id, created_at, updated_at)
        VALUES (${change.id}, '${change.number}', 'Test Change ${change.id}', '${change.type}', '${change.status}', '${change.priority}', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
      `);
    }
  }

  describe('generateChangeNumber', () => {
    it('should generate change number without schema errors', async () => {
      const number = await generateChangeNumber();

      expect(number).toBeDefined();
      expect(typeof number).toBe('string');
      expect(number).toMatch(/^CC-\d{4}-\d{4}$/);
    });
  });

  describe('listChangeRequests', () => {
    it('should query without schema errors', async () => {
      seedChangeRequests();

      const result = await listChangeRequests({});

      expect(result).toBeDefined();
      expect(result.changes).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });

    it('should return paginated results', async () => {
      seedChangeRequests();

      const result = await listChangeRequests({ page: 1, limit: 2 });

      expect(result.changes.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      seedChangeRequests();

      const result = await listChangeRequests({ status: 'draft' });

      expect(result.changes.every(r => r.status === 'draft')).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await listChangeRequests({ status: 'closed' });

      expect(result.changes).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getChangeRequestById', () => {
    it('should query without schema errors', async () => {
      seedChangeRequests();

      const request = await getChangeRequestById(1);

      expect(request).toBeDefined();
      expect(request?.id).toBe(1);
    });

    it('should return null for non-existent request', async () => {
      const request = await getChangeRequestById(99999);

      expect(request).toBeNull();
    });

    it('should return all request fields', async () => {
      seedChangeRequests();

      const request = await getChangeRequestById(1);

      expect(request).toHaveProperty('changeNumber');
      expect(request).toHaveProperty('title');
      expect(request).toHaveProperty('changeType');
      expect(request).toHaveProperty('status');
      expect(request).toHaveProperty('priority');
    });
  });

  describe('createChangeRequest', () => {
    it('should insert without schema errors', async () => {
      const request = await createChangeRequest({
        title: 'Test Change Request',
        changeType: 'process',
        description: 'Test description',
        justification: 'Test justification',
        priority: 'high',
        ownerId: 1,
      }, 1);

      expect(request).toBeDefined();
      expect(request.id).toBeGreaterThan(0);
    });

    it('should set initial status to draft', async () => {
      const request = await createChangeRequest({
        title: 'Draft Change',
        changeType: 'equipment',
        priority: 'medium',
        ownerId: 1,
      }, 1);

      expect(request.status).toBe('draft');
    });

    it('should generate change number automatically', async () => {
      const request = await createChangeRequest({
        title: 'Auto Number Test',
        changeType: 'document',
        priority: 'low',
        ownerId: 1,
      }, 1);

      expect(request.changeNumber).toMatch(/^CC-\d{4}-\d{4}$/);
    });
  });

  describe('updateChangeRequest', () => {
    it('should update without schema errors', async () => {
      seedChangeRequests();

      const updated = await updateChangeRequest(1, {
        title: 'Updated Title',
        priority: 'urgent',
      }, 1);

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('urgent');
    });

    it('should preserve unchanged fields', async () => {
      seedChangeRequests();
      const original = await getChangeRequestById(1);

      const updated = await updateChangeRequest(1, { title: 'New Title' }, 1);

      expect(updated.changeType).toBe(original?.changeType);
    });
  });

  describe('Schema Validation', () => {
    it('should handle all change request columns correctly', async () => {
      const request = await createChangeRequest({
        title: 'Schema Validation',
        changeType: 'process',
        description: 'Full description',
        justification: 'Full justification',
        impactAssessment: 'Impact details',
        riskAssessment: 'Risk details',
        priority: 'high',
        ownerId: 1,
        targetDate: getSqliteDateOffset(30),
      }, 1);

      expect(request).toHaveProperty('id');
      expect(request).toHaveProperty('changeNumber');
      expect(request).toHaveProperty('title');
      expect(request).toHaveProperty('changeType');
      expect(request).toHaveProperty('status');
      expect(request).toHaveProperty('priority');
      expect(request).toHaveProperty('createdAt');
      expect(request).toHaveProperty('updatedAt');
    });
  });
});
