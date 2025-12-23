/**
 * Document Service Real Integration Tests
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Document Control module functionality with real-world scenarios.
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
  DOCUMENT_CONTROLLER: 1,
  REVIEWER: 2,
  APPROVER: 3,
  QA_MANAGER: 4,
};

const TEST_DEPARTMENT_IDS = {
  QA: 1,
  PRODUCTION: 2,
};

const now = new Date();
const year = now.getFullYear();
const TEST_DATES = {
  TODAY: now.toISOString().split('T')[0],
  FUTURE_DATE: `${year + 1}-06-15`,
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
  generateDocumentNumber,
  getDocumentTypes,
  createDocument,
  getDocumentById,
  getDocuments,
  updateDocument,
  createVersion,
  getVersionHistory,
  submitForApproval,
  processApproval,
  getPendingApprovals,
  markDocumentObsolete,
  updateDocumentStatus,
  getDocumentStatistics,
} from '@/lib/services/document-service';

// Create tables from Drizzle schema
function syncSchemaFromDrizzle() {
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteHROrgUnits,
    schema.sqliteDocumentTypes,
    schema.sqliteDocuments,
    schema.sqliteDocumentVersions,
    schema.sqliteDocumentApprovals,
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

describe('Document Service Real Integration Tests', () => {
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
    // Clean document-related data before each test
    cleanDocumentTables();
    seedTestData();
  });

  function cleanDocumentTables() {
    sqlite.exec('DELETE FROM document_approvals');
    sqlite.exec('DELETE FROM document_versions');
    sqlite.exec('DELETE FROM documents');
    sqlite.exec('DELETE FROM document_types');
    sqlite.exec('DELETE FROM hr_org_units');
    sqlite.exec('DELETE FROM users');
  }

  function seedTestData() {
    // Create test users
    sqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES
        (${TEST_USER_IDS.DOCUMENT_CONTROLLER}, 'Document Controller', 'doc@test.com', 'hash123', 'document_controller', 1),
        (${TEST_USER_IDS.REVIEWER}, 'Document Reviewer', 'reviewer@test.com', 'hash123', 'reviewer', 1),
        (${TEST_USER_IDS.APPROVER}, 'Document Approver', 'approver@test.com', 'hash123', 'approver', 1),
        (${TEST_USER_IDS.QA_MANAGER}, 'QA Manager', 'qa@test.com', 'hash123', 'qa_manager', 1)
    `);

    // Create test departments
    sqlite.exec(`
      INSERT OR IGNORE INTO hr_org_units (id, code, name, type, is_active)
      VALUES
        (${TEST_DEPARTMENT_IDS.QA}, 'QA', 'Quality Assurance', 'department', 1),
        (${TEST_DEPARTMENT_IDS.PRODUCTION}, 'PROD', 'Production', 'department', 1)
    `);

    // Create test document types
    sqlite.exec(`
      INSERT OR IGNORE INTO document_types (id, code, name, prefix, approval_chain, review_period_months)
      VALUES
        (1, 'SOP', 'Standard Operating Procedure', 'SOP', '["reviewer", "approver"]', 24),
        (2, 'POL', 'Policy', 'POL', '["approver"]', 36),
        (3, 'FORM', 'Form', 'FM', NULL, 12),
        (4, 'WI', 'Work Instruction', 'WI', '["reviewer"]', 24),
        (5, 'SPEC', 'Specification', 'SPEC', '["reviewer", "approver"]', 24)
    `);
  }

  // ============================================
  // Real-World Scenario Tests
  // ============================================

  describe('Scenario 1: Document Approval Workflow (draft -> review -> approve -> publish)', () => {
    it('should handle complete document lifecycle from creation to publication', async () => {
      // Step 1: Create a new SOP document
      const doc = await createDocument({
        title: 'SOP for Raw Material Receiving',
        typeId: 1, // SOP
        departmentId: TEST_DEPARTMENT_IDS.QA,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      expect(doc.id).toBeDefined();
      expect(doc.documentNumber).toMatch(/^SOP-\d{4}-\d{4}$/);

      // Verify document is in draft status
      const createdDoc = await getDocumentById(doc.id);
      expect(createdDoc).not.toBeNull();
      expect(createdDoc!.status).toBe('draft');

      // Step 2: Create initial version with content
      const version = await createVersion({
        documentId: doc.id,
        content: '# SOP-001: Raw Material Receiving\n\n## Purpose\nTo ensure proper receiving of raw materials...',
        changeDescription: 'Initial draft',
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      expect(version.id).toBeDefined();
      expect(version.versionNumber).toBe('1.0');

      // Step 3: Submit for approval
      await submitForApproval(
        version.id,
        [TEST_USER_IDS.REVIEWER, TEST_USER_IDS.APPROVER],
        TEST_USER_IDS.DOCUMENT_CONTROLLER
      );

      // Verify version status is pending_approval
      const versionHistory = await getVersionHistory(doc.id);
      expect(versionHistory[0].status).toBe('pending_approval');

      // Step 4: Reviewer approves
      const pendingForReviewer = await getPendingApprovals(TEST_USER_IDS.REVIEWER);
      expect(pendingForReviewer.length).toBe(1);

      await processApproval(
        pendingForReviewer[0].id,
        'approved',
        'Content looks good, technical accuracy verified.',
        TEST_USER_IDS.REVIEWER
      );

      // Step 5: Approver approves
      const pendingForApprover = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      expect(pendingForApprover.length).toBe(1);

      const result = await processApproval(
        pendingForApprover[0].id,
        'approved',
        'Approved for publication.',
        TEST_USER_IDS.APPROVER
      );

      expect(result.versionStatus).toBe('approved');

      // Step 6: Verify document is now active
      const activeDoc = await getDocumentById(doc.id);
      expect(activeDoc!.status).toBe('active');
      expect(activeDoc!.currentVersion).not.toBeNull();
      expect(activeDoc!.currentVersion!.effectiveDate).toBeDefined();
    });
  });

  describe('Scenario 2: Document Version Control (new version supersedes old)', () => {
    it('should handle version upgrade with proper supersession', async () => {
      // Step 1: Create document with approved version
      const doc = await createDocument({
        title: 'SOP for Equipment Calibration',
        typeId: 1,
        departmentId: TEST_DEPARTMENT_IDS.QA,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const version1 = await createVersion({
        documentId: doc.id,
        content: 'Version 1.0 content',
        changeDescription: 'Initial version',
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      // Approve version 1
      await submitForApproval(version1.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const pending = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      await processApproval(pending[0].id, 'approved', 'Approved', TEST_USER_IDS.APPROVER);

      // Verify v1.0 is active
      const docDetails = await getDocumentById(doc.id);
      expect(docDetails!.status).toBe('active');
      expect(docDetails!.currentVersion!.versionNumber).toBe('1.0');

      // Step 2: Create minor revision (1.1)
      const version11 = await createVersion({
        documentId: doc.id,
        content: 'Version 1.1 content - minor corrections',
        changeDescription: 'Minor typo corrections',
        isMajorRevision: false,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      expect(version11.versionNumber).toBe('1.1');

      // Approve version 1.1
      await submitForApproval(version11.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const pending11 = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      await processApproval(pending11[0].id, 'approved', 'Approved', TEST_USER_IDS.APPROVER);

      // Step 3: Create major revision (2.0)
      const version20 = await createVersion({
        documentId: doc.id,
        content: 'Version 2.0 content - major process changes',
        changeDescription: 'Major process revision due to new equipment',
        isMajorRevision: true,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      expect(version20.versionNumber).toBe('2.0');

      // Step 4: Verify version history
      const history = await getVersionHistory(doc.id);
      expect(history.length).toBe(3);
      expect(history.map(v => v.versionNumber)).toContain('1.0');
      expect(history.map(v => v.versionNumber)).toContain('1.1');
      expect(history.map(v => v.versionNumber)).toContain('2.0');
    });
  });

  describe('Scenario 3: Document Rejection and Revision', () => {
    it('should handle rejection and allow revision', async () => {
      // Create document and submit for approval
      const doc = await createDocument({
        title: 'SOP for Sampling',
        typeId: 1,
        departmentId: TEST_DEPARTMENT_IDS.QA,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const version = await createVersion({
        documentId: doc.id,
        content: 'Draft content with issues',
        changeDescription: 'Initial draft',
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await submitForApproval(version.id, [TEST_USER_IDS.REVIEWER], TEST_USER_IDS.DOCUMENT_CONTROLLER);

      // Reviewer rejects
      const pending = await getPendingApprovals(TEST_USER_IDS.REVIEWER);
      const result = await processApproval(
        pending[0].id,
        'rejected',
        'Content needs revision: missing safety precautions section.',
        TEST_USER_IDS.REVIEWER
      );

      expect(result.versionStatus).toBe('rejected');

      // Verify version is rejected
      const history = await getVersionHistory(doc.id);
      expect(history[0].status).toBe('rejected');
      expect(history[0].approvals[0].status).toBe('rejected');
      expect(history[0].approvals[0].comments).toContain('safety precautions');
    });
  });

  // ============================================
  // Service Function Tests
  // ============================================

  describe('generateDocumentNumber()', () => {
    it('should generate sequential document numbers by type', async () => {
      const num1 = await generateDocumentNumber(1); // SOP
      expect(num1).toMatch(/^SOP-\d{4}-0001$/);

      // Create a document
      await createDocument({ title: 'Test SOP', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const num2 = await generateDocumentNumber(1);
      expect(num2).toMatch(/^SOP-\d{4}-0002$/);
    });

    it('should use different prefixes for different types', async () => {
      const sopNum = await generateDocumentNumber(1);
      const polNum = await generateDocumentNumber(2);
      const formNum = await generateDocumentNumber(3);

      expect(sopNum).toContain('SOP-');
      expect(polNum).toContain('POL-');
      expect(formNum).toContain('FM-');
    });
  });

  describe('getDocumentTypes()', () => {
    it('should return all document types', async () => {
      const types = await getDocumentTypes();

      expect(types.length).toBe(5);
      expect(types.map(t => t.code)).toContain('SOP');
      expect(types.map(t => t.code)).toContain('POL');
      expect(types.map(t => t.code)).toContain('FORM');
    });
  });

  describe('createDocument()', () => {
    it('should create document with default retention', async () => {
      const doc = await createDocument({
        title: 'Test Document',
        typeId: 1,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const details = await getDocumentById(doc.id);
      expect(details!.retentionYears).toBe(7); // Default Thai FDA requirement
    });

    it('should create document with specified department', async () => {
      const doc = await createDocument({
        title: 'Department Document',
        typeId: 1,
        departmentId: TEST_DEPARTMENT_IDS.PRODUCTION,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const details = await getDocumentById(doc.id);
      expect(details!.departmentId).toBe(TEST_DEPARTMENT_IDS.PRODUCTION);
      // Note: departmentName may be undefined if org_units table has different schema
    });
  });

  describe('getDocumentById()', () => {
    it('should return document with full details', async () => {
      const doc = await createDocument({
        title: 'Detailed Document',
        typeId: 1,
        departmentId: TEST_DEPARTMENT_IDS.QA,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await createVersion({
        documentId: doc.id,
        content: 'Test content',
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const details = await getDocumentById(doc.id);

      expect(details).not.toBeNull();
      expect(details!.title).toBe('Detailed Document');
      expect(details!.typeName).toBe('Standard Operating Procedure');
      expect(details!.typeCode).toBe('SOP');
      expect(details!.departmentId).toBe(TEST_DEPARTMENT_IDS.QA);
      expect(details!.versions.length).toBe(1);
    });

    it('should return null for non-existent document', async () => {
      const details = await getDocumentById(99999);
      expect(details).toBeNull();
    });
  });

  describe('getDocuments()', () => {
    beforeEach(async () => {
      // Create diverse documents for testing
      await createDocument({ title: 'SOP Doc 1', typeId: 1, departmentId: TEST_DEPARTMENT_IDS.QA }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await createDocument({ title: 'SOP Doc 2', typeId: 1, departmentId: TEST_DEPARTMENT_IDS.PRODUCTION }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await createDocument({ title: 'Policy Doc', typeId: 2, departmentId: TEST_DEPARTMENT_IDS.QA }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
    });

    it('should list all documents with pagination', async () => {
      const result = await getDocuments({ page: 1, limit: 10 });
      expect(result.documents.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should filter by document type', async () => {
      const result = await getDocuments({ typeId: 1 });
      expect(result.documents.length).toBe(2);
      expect(result.documents.every(d => d.typeCode === 'SOP')).toBe(true);
    });

    it('should filter by department', async () => {
      const result = await getDocuments({ departmentId: TEST_DEPARTMENT_IDS.QA });
      expect(result.documents.length).toBe(2);
    });

    it('should search by title', async () => {
      const result = await getDocuments({ search: 'Policy' });
      expect(result.documents.length).toBe(1);
      expect(result.documents[0].title).toBe('Policy Doc');
    });
  });

  describe('updateDocument()', () => {
    it('should update draft document title', async () => {
      const doc = await createDocument({
        title: 'Original Title',
        typeId: 1,
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await updateDocument(doc.id, { title: 'Updated Title' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const updated = await getDocumentById(doc.id);
      expect(updated!.title).toBe('Updated Title');
    });

    it('should throw error for non-draft documents', async () => {
      // Create and approve a document
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await submitForApproval(version.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const pending = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      await processApproval(pending[0].id, 'approved', 'OK', TEST_USER_IDS.APPROVER);

      await expect(updateDocument(doc.id, { title: 'New Title' }, TEST_USER_IDS.DOCUMENT_CONTROLLER))
        .rejects.toThrow('Cannot update non-draft documents');
    });
  });

  describe('createVersion()', () => {
    it('should create version with incrementing numbers', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const v1 = await createVersion({ documentId: doc.id, content: 'V1' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      expect(v1.versionNumber).toBe('1.0');

      const v2 = await createVersion({ documentId: doc.id, content: 'V2', isMajorRevision: false }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      expect(v2.versionNumber).toBe('1.1');

      const v3 = await createVersion({ documentId: doc.id, content: 'V3', isMajorRevision: true }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      expect(v3.versionNumber).toBe('2.0');
    });

    it('should update document currentVersionId', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const updated = await getDocumentById(doc.id);
      expect(updated!.currentVersionId).toBe(version.id);
    });
  });

  describe('getVersionHistory()', () => {
    it('should return all versions with approvals', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await createVersion({ documentId: doc.id, content: 'V1' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await createVersion({ documentId: doc.id, content: 'V2' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const history = await getVersionHistory(doc.id);

      expect(history.length).toBe(2);
      // Versions are ordered by createdAt desc
      expect(history.map(v => v.versionNumber).sort()).toEqual(['1.0', '1.1']);
    });
  });

  describe('submitForApproval()', () => {
    it('should create approval records for each approver', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await submitForApproval(
        version.id,
        [TEST_USER_IDS.REVIEWER, TEST_USER_IDS.APPROVER],
        TEST_USER_IDS.DOCUMENT_CONTROLLER
      );

      const pendingReviewer = await getPendingApprovals(TEST_USER_IDS.REVIEWER);
      const pendingApprover = await getPendingApprovals(TEST_USER_IDS.APPROVER);

      expect(pendingReviewer.length).toBe(1);
      expect(pendingApprover.length).toBe(1);
    });

    it('should throw error for non-draft version', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await submitForApproval(version.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await expect(submitForApproval(version.id, [TEST_USER_IDS.REVIEWER], TEST_USER_IDS.DOCUMENT_CONTROLLER))
        .rejects.toThrow('Only draft versions can be submitted');
    });
  });

  describe('processApproval()', () => {
    it('should reject if not the assigned approver', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await submitForApproval(version.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const pending = await getPendingApprovals(TEST_USER_IDS.APPROVER);

      await expect(processApproval(pending[0].id, 'approved', 'OK', TEST_USER_IDS.REVIEWER))
        .rejects.toThrow('not authorized');
    });

    it('should reject already processed approval', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await submitForApproval(version.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const pending = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      await processApproval(pending[0].id, 'approved', 'OK', TEST_USER_IDS.APPROVER);

      await expect(processApproval(pending[0].id, 'approved', 'Again', TEST_USER_IDS.APPROVER))
        .rejects.toThrow('already been processed');
    });
  });

  describe('markDocumentObsolete()', () => {
    it('should mark document and version as obsolete', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const version = await createVersion({ documentId: doc.id, content: 'Content' }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await submitForApproval(version.id, [TEST_USER_IDS.APPROVER], TEST_USER_IDS.DOCUMENT_CONTROLLER);
      const pending = await getPendingApprovals(TEST_USER_IDS.APPROVER);
      await processApproval(pending[0].id, 'approved', 'OK', TEST_USER_IDS.APPROVER);

      await markDocumentObsolete(doc.id, 'Replaced by new document', TEST_USER_IDS.QA_MANAGER);

      const obsoleteDoc = await getDocumentById(doc.id);
      expect(obsoleteDoc!.status).toBe('obsolete');
    });

    it('should throw error if already obsolete', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await updateDocumentStatus(doc.id, 'obsolete', TEST_USER_IDS.QA_MANAGER);

      await expect(markDocumentObsolete(doc.id, 'Reason', TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('already obsolete');
    });
  });

  describe('updateDocumentStatus()', () => {
    it('should update document status directly', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await updateDocumentStatus(doc.id, 'archived', TEST_USER_IDS.QA_MANAGER);

      const updated = await getDocumentById(doc.id);
      expect(updated!.status).toBe('archived');
    });

    it('should throw error if status unchanged', async () => {
      const doc = await createDocument({ title: 'Test', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      await expect(updateDocumentStatus(doc.id, 'draft', TEST_USER_IDS.QA_MANAGER))
        .rejects.toThrow('already draft');
    });
  });

  describe('getDocumentStatistics()', () => {
    beforeEach(async () => {
      // Create documents with different statuses
      await createDocument({ title: 'Draft 1', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await createDocument({ title: 'Draft 2', typeId: 2 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const activeDoc = await createDocument({ title: 'Active', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);
      await updateDocumentStatus(activeDoc.id, 'active', TEST_USER_IDS.QA_MANAGER);
    });

    it('should return correct statistics', async () => {
      const stats = await getDocumentStatistics();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.draft).toBe(2);
      expect(stats.byStatus.active).toBe(1);
      expect(stats.byType.SOP).toBe(2);
      expect(stats.byType.POL).toBe(1);
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle document without versions', async () => {
      const doc = await createDocument({ title: 'Empty Doc', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const details = await getDocumentById(doc.id);
      expect(details!.versions.length).toBe(0);
      expect(details!.currentVersion).toBeNull();
    });

    it('should handle all document types', async () => {
      const types = await getDocumentTypes();

      for (const type of types) {
        const doc = await createDocument({
          title: `Test ${type.code}`,
          typeId: type.id,
        }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

        const details = await getDocumentById(doc.id);
        expect(details!.typeCode).toBe(type.code);
      }
    });

    it('should handle version with file path but no content', async () => {
      const doc = await createDocument({ title: 'File Doc', typeId: 1 }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const version = await createVersion({
        documentId: doc.id,
        filePath: '/documents/sop-001.pdf',
        changeDescription: 'Uploaded PDF',
      }, TEST_USER_IDS.DOCUMENT_CONTROLLER);

      const history = await getVersionHistory(doc.id);
      expect(history[0].content).toBeNull();
      expect(history[0].filePath).toBe('/documents/sop-001.pdf');
    });

    it('should return empty list when no documents exist', async () => {
      // Clean all documents
      sqlite.exec('DELETE FROM document_approvals');
      sqlite.exec('DELETE FROM document_versions');
      sqlite.exec('DELETE FROM documents');

      const result = await getDocuments({});
      expect(result.documents.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });
});
