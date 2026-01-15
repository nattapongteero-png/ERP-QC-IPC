/**
 * CAPA Service Integration Tests
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
import { seedTestUser, seedCapaData } from '../../../helpers/service-test-seeds';

// Now import the service (after mock is set up)
import {
  generateCapaNumber,
  listCapas,
  getCapaById,
  getCapaDetails,
  createCapa,
  updateCapa,
  addAction,
  getCapaDashboard,
} from '@/lib/services/capa-service';

describe('CAPA Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteCapa,
      schema.sqliteCapaActions,
      schema.sqliteCapaApprovals,
      schema.sqliteCapaEffectiveness,
      schema.sqliteCapaAttachments,
      schema.sqliteDeviations,
      schema.sqliteComplaints,
      schema.sqliteAuditFindings,
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
      'capa_attachments',
      'capa_effectiveness',
      'capa_approvals',
      'capa_actions',
      'capa',
      'audit_findings',
      'complaints',
      'deviations',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  describe('generateCapaNumber', () => {
    it('should generate CAPA number without schema errors', async () => {
      const number = await generateCapaNumber();

      expect(number).toBeDefined();
      expect(typeof number).toBe('string');
      expect(number).toMatch(/^CAPA-\d{4}-\d{4}$/);
    });
  });

  describe('listCapas', () => {
    it('should query without schema errors', async () => {
      seedCapaData(sqlite);

      const result = await listCapas({});

      expect(result).toBeDefined();
      expect(result.capas).toBeInstanceOf(Array);
      expect(typeof result.total).toBe('number');
    });

    it('should return paginated results', async () => {
      seedCapaData(sqlite);

      const result = await listCapas({ page: 1, limit: 2 });

      expect(result.capas.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      seedCapaData(sqlite);

      const result = await listCapas({ status: 'open' });

      expect(result.capas.every(c => c.status === 'open')).toBe(true);
    });

    it('should filter by type', async () => {
      seedCapaData(sqlite);

      const result = await listCapas({ type: 'corrective' });

      expect(result.capas.every(c => c.type === 'corrective')).toBe(true);
    });

    it('should filter by priority', async () => {
      seedCapaData(sqlite);

      const result = await listCapas({ priority: 'high' });

      expect(result.capas.every(c => c.priority === 'high')).toBe(true);
    });

    it('should handle empty results', async () => {
      const result = await listCapas({ status: 'closed' });

      expect(result.capas).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getCapaById', () => {
    it('should query without schema errors', async () => {
      seedCapaData(sqlite);

      const capa = await getCapaById(1);

      expect(capa).toBeDefined();
      expect(capa?.id).toBe(1);
    });

    it('should return null for non-existent CAPA', async () => {
      const capa = await getCapaById(99999);

      expect(capa).toBeNull();
    });

    it('should return all CAPA fields', async () => {
      seedCapaData(sqlite);

      const capa = await getCapaById(1);

      expect(capa).toHaveProperty('capaNumber');
      expect(capa).toHaveProperty('type');
      expect(capa).toHaveProperty('status');
      expect(capa).toHaveProperty('priority');
      expect(capa).toHaveProperty('title');
    });
  });

  describe('getCapaDetails', () => {
    it('should query with joins without schema errors', async () => {
      seedCapaData(sqlite);

      const details = await getCapaDetails(1);

      expect(details).toBeDefined();
      expect(details?.id).toBeDefined();
      expect(details?.actions).toBeInstanceOf(Array);
    });

    it('should include related actions', async () => {
      seedCapaData(sqlite);

      const details = await getCapaDetails(1);

      // seedCapaData adds 2 actions to CAPA 1
      expect(details?.actions.length).toBe(2);
    });

    it('should return null for non-existent CAPA', async () => {
      const details = await getCapaDetails(99999);

      expect(details).toBeNull();
    });
  });

  describe('createCapa', () => {
    it('should insert without schema errors', async () => {
      const capa = await createCapa({
        type: 'corrective',
        priority: 'high',
        title: 'Test CAPA',
        sourceType: 'deviation',
        ownerId: 1,
        dueDate: '2024-12-31',
      }, 1);

      expect(capa).toBeDefined();
      expect(capa.id).toBeGreaterThan(0);
    });

    it('should set initial status to open', async () => {
      const capa = await createCapa({
        type: 'preventive',
        priority: 'medium',
        title: 'New CAPA',
        sourceType: 'complaint',
        ownerId: 1,
        dueDate: '2024-12-31',
      }, 1);

      expect(capa.status).toBe('open');
    });

    it('should generate CAPA number automatically', async () => {
      const capa = await createCapa({
        type: 'corrective',
        priority: 'low',
        title: 'Auto Number Test',
        sourceType: 'audit_finding',
        ownerId: 1,
        dueDate: '2024-12-31',
      }, 1);

      expect(capa.capaNumber).toMatch(/^CAPA-\d{4}-\d{4}$/);
    });
  });

  describe('updateCapa', () => {
    it('should update without schema errors', async () => {
      seedCapaData(sqlite);

      const updated = await updateCapa(1, {
        title: 'Updated Title',
        priority: 'high',
      }, 1);

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
    });

    it('should preserve unchanged fields', async () => {
      seedCapaData(sqlite);
      const original = await getCapaById(1);

      const updated = await updateCapa(1, { title: 'New Title' }, 1);

      expect(updated.type).toBe(original?.type);
    });
  });

  describe('addAction', () => {
    it('should insert action without schema errors', async () => {
      seedCapaData(sqlite);

      const action = await addAction(1, {
        description: 'New action',
        actionType: 'corrective',
        assigneeId: 1,
        dueDate: '2024-12-31',
      }, 1);

      expect(action).toBeDefined();
      expect(action.id).toBeGreaterThan(0);
    });

    it('should link action to CAPA', async () => {
      seedCapaData(sqlite);

      const action = await addAction(1, {
        description: 'Linked action',
        actionType: 'preventive',
        assigneeId: 1,
        dueDate: '2024-12-31',
      }, 1);

      const details = await getCapaDetails(1);
      const foundAction = details?.actions.find(a => a.id === action.id);

      expect(foundAction).toBeDefined();
      expect(foundAction?.description).toBe('Linked action');
    });
  });

  describe('getCapaDashboard', () => {
    it('should aggregate data without schema errors', async () => {
      seedCapaData(sqlite);

      const dashboard = await getCapaDashboard();

      expect(dashboard).toBeDefined();
      expect(typeof dashboard.totalOpen).toBe('number');
      expect(dashboard.byPriority).toBeDefined();
      expect(dashboard.byStatus).toBeDefined();
    });

    it('should count open CAPAs correctly', async () => {
      seedCapaData(sqlite);

      const dashboard = await getCapaDashboard();

      // seedCapaData creates 1 open CAPA
      expect(dashboard.totalOpen).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty database', async () => {
      const dashboard = await getCapaDashboard();

      expect(dashboard.totalOpen).toBe(0);
    });
  });

  describe('Schema Validation', () => {
    it('should handle all CAPA columns correctly', async () => {
      // This test ensures all column references are valid
      const capa = await createCapa({
        type: 'corrective',
        priority: 'high',
        title: 'Schema Test',
        sourceType: 'deviation',
        rootCauseAnalysis: 'Test root cause',
        ownerId: 1,
        dueDate: '2024-12-31',
      }, 1);

      // Verify all expected fields exist
      expect(capa).toHaveProperty('id');
      expect(capa).toHaveProperty('capaNumber');
      expect(capa).toHaveProperty('type');
      expect(capa).toHaveProperty('status');
      expect(capa).toHaveProperty('priority');
      expect(capa).toHaveProperty('title');
      expect(capa).toHaveProperty('sourceType');
      expect(capa).toHaveProperty('createdBy');
      expect(capa).toHaveProperty('createdAt');
      expect(capa).toHaveProperty('updatedAt');
    });

    it('should handle all action columns correctly', async () => {
      seedCapaData(sqlite);

      const action = await addAction(1, {
        description: 'Column test',
        actionType: 'corrective',
        assigneeId: 1,
        dueDate: '2024-12-31',
      }, 1);

      expect(action).toHaveProperty('id');
      expect(action).toHaveProperty('capaId');
      expect(action).toHaveProperty('actionNumber');
      expect(action).toHaveProperty('description');
      expect(action).toHaveProperty('assigneeId');
      expect(action).toHaveProperty('dueDate');
      expect(action).toHaveProperty('status');
    });
  });
});
