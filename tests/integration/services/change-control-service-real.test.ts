/**
 * Change Control Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete change control functionality with real-world scenarios.
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
  generateChangeNumber,
  createChangeRequest,
  getChangeRequestById,
  listChangeRequests,
  updateChangeRequest,
  submitChangeForReview,
  approveChange,
  implementChange,
  closeChange,
} from '@/lib/services/change-control-service';

// Helper to create tables from schema
function createTableFromSchema(db: Database.Database, table: SQLiteTable) {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);

  const columnDefs = Object.entries(columns).map(([, col]) => {
    const colDef = (col as any).getSQLType();
    const notNull = (col as any).notNull ? 'NOT NULL' : '';
    const primaryKey = (col as any).primary ? 'PRIMARY KEY' : '';
    const autoIncrement = (col as any).autoIncrement ? 'AUTOINCREMENT' : '';
    const defaultVal = (col as any).default !== undefined ? `DEFAULT ${(col as any).default}` : '';

    return `${(col as any).name} ${colDef} ${primaryKey} ${autoIncrement} ${notNull} ${defaultVal}`.trim();
  });

  const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')})`;
  db.exec(sql);
}

// Test user IDs
let testUserId: number;
let testOwnerId: number;
let qaApproverId: number;
let prodApproverId: number;
let regApproverId: number;
let mgmtApproverId: number;

beforeAll(async () => {
  // Create in-memory SQLite database
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite, { schema });

  // Create necessary tables
  createTableFromSchema(sqlite, schema.sqliteUsers);
  createTableFromSchema(sqlite, schema.sqliteChangeRequests);
  createTableFromSchema(sqlite, schema.sqliteChangeApprovals);

  // Insert test users
  testUserId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('requester@test.com', 'hash', 'Change Requester', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  testOwnerId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('owner@test.com', 'hash', 'Change Owner', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  qaApproverId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('qa@test.com', 'hash', 'QA Approver', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  prodApproverId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('prod@test.com', 'hash', 'Production Approver', 'production', new Date().toISOString()).lastInsertRowid as number;

  regApproverId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('reg@test.com', 'hash', 'Regulatory Approver', 'quality_control', new Date().toISOString()).lastInsertRowid as number;

  mgmtApproverId = sqlite.prepare(`
    INSERT INTO users (email, password, name, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run('mgmt@test.com', 'hash', 'Management Approver', 'admin', new Date().toISOString()).lastInsertRowid as number;
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(() => {
  // Clear change control tables before each test
  sqlite.exec('DELETE FROM change_approvals');
  sqlite.exec('DELETE FROM change_requests');
});

describe('Change Control Service - Real Database Tests', () => {
  describe('generateChangeNumber', () => {
    it('should generate change number in CC-YYMM-#### format', async () => {
      const changeNumber = await generateChangeNumber();
      expect(changeNumber).toMatch(/^CC-\d{4}-\d{4}$/);
    });

    it('should generate sequential numbers within same month', async () => {
      // Create a change request first to increment the counter
      const change1 = await createChangeRequest(
        {
          title: 'First Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const change2 = await createChangeRequest(
        {
          title: 'Second Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const seq1 = parseInt(change1.changeNumber.split('-')[2], 10);
      const seq2 = parseInt(change2.changeNumber.split('-')[2], 10);

      expect(seq2).toBe(seq1 + 1);
    });
  });

  describe('createChangeRequest', () => {
    it('should create a new change request with all fields', async () => {
      const data = {
        title: 'Update SOP-001 for new equipment',
        changeType: 'document' as const,
        description: 'Update cleaning procedures for new autoclave',
        justification: 'New equipment requires different cleaning protocol',
        impactAssessment: 'Affects production and QC departments',
        riskAssessment: 'Low risk - validated procedure',
        priority: 'medium' as const,
        ownerId: testOwnerId,
        targetDate: '2025-02-01',
      };

      const change = await createChangeRequest(data, testUserId);

      expect(change).toBeDefined();
      expect(change.title).toBe(data.title);
      expect(change.changeType).toBe(data.changeType);
      expect(change.description).toBe(data.description);
      expect(change.justification).toBe(data.justification);
      expect(change.status).toBe('draft');
      expect(change.priority).toBe(data.priority);
      expect(change.requesterId).toBe(testUserId);
      expect(change.ownerId).toBe(testOwnerId);
      expect(change.changeNumber).toMatch(/^CC-\d{4}-\d{4}$/);
    });

    it('should default to medium priority', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      expect(change.priority).toBe('medium');
    });
  });

  describe('getChangeRequestById', () => {
    it('should retrieve change request with approvals', async () => {
      const created = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'equipment' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const retrieved = await getChangeRequestById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.changeNumber).toBe(created.changeNumber);
      expect(retrieved?.approvals).toEqual([]);
    });

    it('should return null for non-existent change', async () => {
      const result = await getChangeRequestById(99999);
      expect(result).toBeNull();
    });
  });

  describe('listChangeRequests', () => {
    it('should list all change requests', async () => {
      await createChangeRequest(
        {
          title: 'Change 1',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );
      await createChangeRequest(
        {
          title: 'Change 2',
          changeType: 'document' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const result = await listChangeRequests();

      expect(result.total).toBe(2);
      expect(result.changes.length).toBe(2);
    });

    it('should filter by status', async () => {
      const change1 = await createChangeRequest(
        {
          title: 'Draft Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const result = await listChangeRequests({ status: 'draft' });

      expect(result.changes.some(c => c.id === change1.id)).toBe(true);
      expect(result.changes.every(c => c.status === 'draft')).toBe(true);
    });
  });

  describe('updateChangeRequest', () => {
    it('should update draft change request', async () => {
      const change = await createChangeRequest(
        {
          title: 'Original Title',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      const updated = await updateChangeRequest(
        change.id,
        {
          title: 'Updated Title',
          priority: 'high',
        },
        testUserId
      );

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('high');
    });

    it('should not allow updates to non-draft changes', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required change',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);

      await expect(
        updateChangeRequest(change.id, { title: 'New Title' }, testUserId)
      ).rejects.toThrow('Cannot update change request that is not in draft status');
    });
  });

  describe('submitChangeForReview', () => {
    it('should submit change for review and create approval records', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required change',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      const submitted = await submitChangeForReview(change.id, testUserId);

      expect(submitted.status).toBe('pending_review');
      expect(submitted.approvals.length).toBe(4); // qa, production, regulatory, management
      expect(submitted.approvals.every(a => a.status === 'pending')).toBe(true);
    });

    it('should require justification before submission', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      await expect(
        submitChangeForReview(change.id, testUserId)
      ).rejects.toThrow('Justification is required');
    });
  });

  describe('approveChange', () => {
    it('should approve change for specific role', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);

      const approved = await approveChange(
        change.id,
        qaApproverId,
        'qa',
        true,
        'QA review passed'
      );

      const qaApproval = approved.approvals.find(a => a.role === 'qa');
      expect(qaApproval?.status).toBe('approved');
      expect(qaApproval?.comments).toBe('QA review passed');
      expect(qaApproval?.approverId).toBe(qaApproverId);
    });

    it('should reject change and update status', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);

      const result = await approveChange(
        change.id,
        prodApproverId,
        'production',
        false,
        'Need more information'
      );

      expect(result.status).toBe('rejected');
      const prodApproval = result.approvals.find(a => a.role === 'production');
      expect(prodApproval?.status).toBe('rejected');
    });

    it('should approve change when all approvals are complete', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);

      await approveChange(change.id, qaApproverId, 'qa', true);
      await approveChange(change.id, prodApproverId, 'production', true);
      await approveChange(change.id, regApproverId, 'regulatory', true);
      const final = await approveChange(change.id, mgmtApproverId, 'management', true);

      expect(final.status).toBe('approved');
    });
  });

  describe('implementChange', () => {
    it('should mark change as implemented', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);
      await approveChange(change.id, qaApproverId, 'qa', true);
      await approveChange(change.id, prodApproverId, 'production', true);
      await approveChange(change.id, regApproverId, 'regulatory', true);
      await approveChange(change.id, mgmtApproverId, 'management', true);

      const implemented = await implementChange(
        change.id,
        testUserId,
        'Implemented in production system'
      );

      expect(implemented.status).toBe('implemented');
      expect(implemented.implementedDate).toBeTruthy();
    });

    it('should not allow implementation of non-approved changes', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      await expect(
        implementChange(change.id, testUserId)
      ).rejects.toThrow('Only approved changes can be implemented');
    });
  });

  describe('closeChange', () => {
    it('should close implemented change', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          justification: 'Required',
          impactAssessment: 'Low impact',
          riskAssessment: 'Low risk',
          ownerId: testOwnerId,
        },
        testUserId
      );

      await submitChangeForReview(change.id, testUserId);
      await approveChange(change.id, qaApproverId, 'qa', true);
      await approveChange(change.id, prodApproverId, 'production', true);
      await approveChange(change.id, regApproverId, 'regulatory', true);
      await approveChange(change.id, mgmtApproverId, 'management', true);
      await implementChange(change.id, testUserId);

      const closed = await closeChange(
        change.id,
        testUserId,
        'Effectiveness verified after 30 days'
      );

      expect(closed.status).toBe('closed');
    });

    it('should not allow closing non-implemented changes', async () => {
      const change = await createChangeRequest(
        {
          title: 'Test Change',
          changeType: 'process' as const,
          ownerId: testOwnerId,
        },
        testUserId
      );

      await expect(
        closeChange(change.id, testUserId)
      ).rejects.toThrow('Only implemented changes can be closed');
    });
  });

  describe('Complete workflow', () => {
    it('should complete full change control workflow', async () => {
      // 1. Create change request
      const change = await createChangeRequest(
        {
          title: 'Implement new cleaning protocol',
          changeType: 'process' as const,
          description: 'Updated cleaning procedure for new equipment',
          justification: 'Regulatory requirement',
          impactAssessment: 'Production and QC departments affected',
          riskAssessment: 'Medium risk - requires validation',
          priority: 'high' as const,
          ownerId: testOwnerId,
          targetDate: '2025-03-01',
        },
        testUserId
      );
      expect(change.status).toBe('draft');

      // 2. Submit for review
      const submitted = await submitChangeForReview(change.id, testUserId);
      expect(submitted.status).toBe('pending_review');
      expect(submitted.approvals.length).toBe(4);

      // 3. Approve by all departments
      await approveChange(change.id, qaApproverId, 'qa', true, 'QA approved');
      await approveChange(change.id, prodApproverId, 'production', true, 'Production approved');
      await approveChange(change.id, regApproverId, 'regulatory', true, 'Regulatory approved');
      const approved = await approveChange(change.id, mgmtApproverId, 'management', true, 'Management approved');
      expect(approved.status).toBe('approved');

      // 4. Implement
      const implemented = await implementChange(change.id, testUserId, 'Deployed to production');
      expect(implemented.status).toBe('implemented');

      // 5. Close after verification
      const closed = await closeChange(change.id, testUserId, 'Verified effective');
      expect(closed.status).toBe('closed');
    });
  });
});
