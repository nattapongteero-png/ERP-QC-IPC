/**
 * Issues Service Real Integration Tests
 * Feature: Issue Tracker (014-unit-cost)
 *
 * These tests call actual service functions with real SQLite database
 * to verify complete Issues module functionality with real-world scenarios.
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
  createIssue,
  updateIssue,
  getIssue,
  listIssues,
  deleteIssue,
  generateIssueNumber,
  createIssueCategory,
  listIssueCategories,
} from '@/lib/services/issues.service';

import {
  createComment,
  listComments,
  updateComment,
  deleteComment,
} from '@/lib/services/issues-comments.service';

import {
  getIssueTimeline,
} from '@/lib/services/issues-timeline.service';

import {
  getIssueDashboardMetrics,
} from '@/lib/services/issues-dashboard.service';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [, column] of Object.entries(columns)) {
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
  const tablesToCreate = [
    schema.sqliteUsers,
    schema.sqliteIssueCategories,
    schema.sqliteIssues,
    schema.sqliteIssueTags,
    schema.sqliteIssueTagLinks,
    schema.sqliteIssueComments,
    schema.sqliteIssueAttachments,
    schema.sqliteIssueAuditEvents,
    schema.sqliteIssueNotifications,
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

// Seed test data
function seedTestData() {
  // Insert test user
  sqlite.exec(`
    INSERT INTO users (id, email, name, role, password, is_active, created_at, updated_at)
    VALUES
      (1, 'admin@test.com', 'Admin User', 'admin', 'hash', 1, datetime('now'), datetime('now')),
      (2, 'user@test.com', 'Regular User', 'user', 'hash', 1, datetime('now'), datetime('now'))
  `);

  // Insert test categories
  sqlite.exec(`
    INSERT INTO issue_categories (id, name, description, type, required_fields, is_active, created_at, updated_at)
    VALUES
      (1, 'Software Bug', 'Software bugs and defects', 'software', '["title","description"]', 1, datetime('now'), datetime('now')),
      (2, 'Feature Request', 'New feature requests', 'software', '["title","description"]', 1, datetime('now'), datetime('now')),
      (3, 'Operational Issue', 'Operational issues', 'operational', '["title","description"]', 1, datetime('now'), datetime('now'))
  `);
}

// Clean issue-related tables before each test
function cleanIssueTables() {
  const tablesToClean = [
    'issue_audit_events',
    'issue_notifications',
    'issue_attachments',
    'issue_comments',
    'issue_tag_links',
    'issues',
  ];

  for (const table of tablesToClean) {
    try {
      sqlite.exec(`DELETE FROM ${table}`);
    } catch {
      // Table might not exist
    }
  }
}

// Single root describe block to share database connection
describe('Issues Module Real Integration Tests', () => {
  beforeAll(async () => {
    console.log('Setting up test environment...');
    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    sqlite.pragma('journal_mode = WAL');
    testDb = drizzle(sqlite, { schema });

    // Create tables from Drizzle schema
    syncSchemaFromDrizzle();
    seedTestData();
  });

  afterAll(() => {
    console.log('Cleaning up test environment...');
    sqlite.close();
  });

  // Issues Service Tests
  describe('Issues Service', () => {
    beforeEach(() => {
      cleanIssueTables();
    });

    describe('Issue Number Generation', () => {
      it('should generate sequential issue numbers', async () => {
        const year = new Date().getFullYear();
        const num1 = await generateIssueNumber();
        expect(num1).toBe(`ISS-${year}-0001`);

        // Create an issue to increment counter
        await createIssue(
          {
            title: 'Test Issue',
            description: { summary: 'Test summary' },
            categoryId: 1,
            severity: 'minor',
          },
          1,
          'submitted'
        );

        const num2 = await generateIssueNumber();
        expect(num2).toBe(`ISS-${year}-0002`);
      });
    });

    describe('Create Issue', () => {
      it('should create issue with valid data', async () => {
        const year = new Date().getFullYear();
        const issue = await createIssue(
          {
            title: 'Login button not working',
            description: {
              summary: 'Users cannot login to the system',
              impact: 'Production users affected',
            },
            categoryId: 1,
            severity: 'critical',
          },
          1,
          'submitted'
        );

        expect(issue).toBeDefined();
        expect(issue.id).toBeGreaterThan(0);
        expect(issue.issueNumber).toMatch(new RegExp(`^ISS-${year}-\\d{4}$`));
        expect(issue.title).toBe('Login button not working');
        expect(issue.status).toBe('submitted');
        expect(issue.severity).toBe('critical');
        expect(issue.reporterId).toBe(1);
      });

      it('should create issue with draft status', async () => {
        const issue = await createIssue(
          {
            title: 'Draft Issue',
            description: { summary: 'Incomplete' },
            categoryId: 2,
            severity: 'minor',
          },
          2,
          'draft'
        );

        expect(issue.status).toBe('draft');
        expect(issue.reporterId).toBe(2);
      });

      it('should create issue with priority via update', async () => {
        const created = await createIssue(
          {
            title: 'Full Issue',
            description: {
              summary: 'Full description',
              impact: 'High impact',
              environment: 'Production',
            },
            categoryId: 1,
            severity: 'major',
          },
          1,
          'submitted'
        );

        // Update to set priority
        const issue = await updateIssue(created.id, { priority: 'urgent' }, 1);

        expect(issue.priority).toBe('urgent');
        const desc = typeof issue.description === 'string'
          ? JSON.parse(issue.description)
          : issue.description;
        expect(desc.impact).toBe('High impact');
      });
    });

    describe('Get Issue', () => {
      it('should get issue by ID with relations', async () => {
        const created = await createIssue(
          {
            title: 'Test Issue',
            description: { summary: 'Test' },
            categoryId: 1,
            severity: 'major',
          },
          1,
          'submitted'
        );

        const issue = await getIssue(created.id);
        expect(issue).not.toBeNull();
        expect(issue!.id).toBe(created.id);
        expect(issue!.title).toBe('Test Issue');
      });

      it('should return null for non-existent issue', async () => {
        const issue = await getIssue(999);
        expect(issue).toBeNull();
      });
    });

    describe('Update Issue', () => {
      it('should update issue fields', async () => {
        const created = await createIssue(
          {
            title: 'Original Title',
            description: { summary: 'Original' },
            categoryId: 1,
            severity: 'minor',
          },
          1,
          'submitted'
        );

        const updated = await updateIssue(
          created.id,
          {
            title: 'Updated Title',
            status: 'in_progress',
            priority: 'urgent',
          },
          1
        );

        expect(updated.title).toBe('Updated Title');
        expect(updated.status).toBe('in_progress');
        expect(updated.priority).toBe('urgent');
      });

      it('should update issue assignee', async () => {
        const created = await createIssue(
          {
            title: 'Test Issue',
            description: { summary: 'Test' },
            categoryId: 1,
            severity: 'major',
          },
          1,
          'submitted'
        );

        const updated = await updateIssue(
          created.id,
          { assigneeId: 2 },
          1
        );

        expect(updated.assigneeId).toBe(2);
      });

      it('should update issue status to resolved', async () => {
        const created = await createIssue(
          {
            title: 'To Be Resolved',
            description: { summary: 'Test' },
            categoryId: 1,
            severity: 'minor',
          },
          1,
          'submitted'
        );

        const updated = await updateIssue(
          created.id,
          { status: 'resolved' },
          1
        );

        expect(updated.status).toBe('resolved');
        expect(updated.resolvedAt).toBeDefined();
      });
    });

    describe('List Issues', () => {
      beforeEach(async () => {
        await createIssue(
          { title: 'Critical Bug', description: { summary: 'Critical' }, categoryId: 1, severity: 'critical' },
          1,
          'submitted'
        );
        await createIssue(
          { title: 'Major Bug', description: { summary: 'Major' }, categoryId: 1, severity: 'major' },
          1,
          'in_progress'
        );
        await createIssue(
          { title: 'Feature Request', description: { summary: 'Feature' }, categoryId: 2, severity: 'minor' },
          2,
          'submitted'
        );
      });

      it('should list all issues with pagination', async () => {
        const result = await listIssues({ page: 1, limit: 10 });

        expect(result.items).toHaveLength(3);
        expect(result.total).toBe(3);
        expect(result.page).toBe(1);
      });

      it('should filter issues by status', async () => {
        const result = await listIssues({ status: 'submitted', page: 1, limit: 10 });

        expect(result.items).toHaveLength(2);
        result.items.forEach(item => {
          expect(item.status).toBe('submitted');
        });
      });

      it('should filter issues by severity', async () => {
        const result = await listIssues({ severity: 'critical', page: 1, limit: 10 });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].severity).toBe('critical');
      });

      it('should filter issues by category', async () => {
        const result = await listIssues({ categoryId: 2, page: 1, limit: 10 });

        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe('Feature Request');
      });

      it('should search issues by title', async () => {
        const result = await listIssues({ search: 'Bug', page: 1, limit: 10 });

        expect(result.items).toHaveLength(2);
      });

      it('should handle pagination correctly', async () => {
        const page1 = await listIssues({ page: 1, limit: 2 });
        expect(page1.items).toHaveLength(2);
        expect(page1.totalPages).toBe(2);

        const page2 = await listIssues({ page: 2, limit: 2 });
        expect(page2.items).toHaveLength(1);
      });
    });

    describe('Delete Issue', () => {
      it('should delete issue', async () => {
        const created = await createIssue(
          {
            title: 'To Be Deleted',
            description: { summary: 'Delete me' },
            categoryId: 1,
            severity: 'minor',
          },
          1,
          'draft'
        );

        const result = await deleteIssue(created.id);
        expect(result).toBe(true);

        const deleted = await getIssue(created.id);
        expect(deleted).toBeNull();
      });
    });
  });

  // Issue Categories Service Tests
  describe('Issue Categories Service', () => {
    describe('List Categories', () => {
      it('should list all active categories', async () => {
        const categories = await listIssueCategories();

        expect(categories.length).toBeGreaterThanOrEqual(3);
        expect(categories[0].name).toBeDefined();
      });

      it('should filter categories by type', async () => {
        const softwareCategories = await listIssueCategories({ type: 'software' });

        softwareCategories.forEach(cat => {
          expect(cat.type).toBe('software');
        });
      });
    });

    describe('Create Category', () => {
      it('should create new category', async () => {
        const category = await createIssueCategory({
          name: 'Security Issue',
          description: 'Security related issues',
          type: 'software',
          requiredFields: ['title', 'description', 'impact'],
        });

        expect(category).toBeDefined();
        expect(category!.name).toBe('Security Issue');
        expect(category!.type).toBe('software');
      });
    });
  });

  // Issue Comments Service Tests
  describe('Issue Comments Service', () => {
    let testIssueId: number;

    beforeAll(async () => {
      cleanIssueTables();
      const issue = await createIssue(
        {
          title: 'Issue for Comments',
          description: { summary: 'Test' },
          categoryId: 1,
          severity: 'major',
        },
        1,
        'submitted'
      );
      testIssueId = issue.id;
    });

    describe('Create Comment', () => {
      it('should create comment on issue', async () => {
        const comment = await createComment(
          testIssueId,
          { content: 'This is a test comment' },
          1
        );

        expect(comment).toBeDefined();
        expect(comment.issueId).toBe(testIssueId);
        expect(comment.content).toBe('This is a test comment');
        expect(comment.authorId).toBe(1);
      });
    });

    describe('List Comments', () => {
      beforeEach(async () => {
        await createComment(testIssueId, { content: 'Comment 1' }, 1);
        await createComment(testIssueId, { content: 'Comment 2' }, 2);
      });

      it('should list all comments for issue', async () => {
        const comments = await listComments(testIssueId);

        expect(comments.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Update Comment', () => {
      it('should update comment content', async () => {
        const comment = await createComment(
          testIssueId,
          { content: 'Original content' },
          1
        );

        const updated = await updateComment(
          comment.id,
          'Updated content',
          1
        );

        expect(updated).not.toBeNull();
        expect(updated!.content).toBe('Updated content');
        expect(updated!.isEdited).toBe(true);
      });
    });

    describe('Delete Comment', () => {
      it('should delete comment', async () => {
        const comment = await createComment(
          testIssueId,
          { content: 'To be deleted' },
          1
        );

        const result = await deleteComment(comment.id, 1);
        expect(result).toBe(true);
      });
    });
  });

  // Issue Timeline Service Tests
  describe('Issue Timeline Service', () => {
    let testIssueId: number;

    beforeAll(async () => {
      cleanIssueTables();
      const issue = await createIssue(
        {
          title: 'Issue for Timeline',
          description: { summary: 'Test' },
          categoryId: 1,
          severity: 'major',
        },
        1,
        'submitted'
      );
      testIssueId = issue.id;

      // Make some updates to create timeline events
      await updateIssue(testIssueId, { status: 'in_progress' }, 1);
      await createComment(testIssueId, { content: 'Working on this' }, 1);
    });

    describe('Get Timeline', () => {
      it('should get timeline events for issue', async () => {
        const timeline = await getIssueTimeline(testIssueId);

        expect(timeline).toBeDefined();
        expect(Array.isArray(timeline)).toBe(true);
      });
    });
  });

  // Issue Dashboard Service Tests
  describe('Issue Dashboard Service', () => {
    beforeAll(async () => {
      cleanIssueTables();
      await createIssue(
        { title: 'Critical 1', description: { summary: 'Test' }, categoryId: 1, severity: 'critical' },
        1,
        'submitted'
      );
      await createIssue(
        { title: 'Major 1', description: { summary: 'Test' }, categoryId: 1, severity: 'major' },
        1,
        'in_progress'
      );
      await createIssue(
        { title: 'Minor 1', description: { summary: 'Test' }, categoryId: 2, severity: 'minor' },
        2,
        'resolved'
      );
    });

    describe('Get Dashboard Metrics', () => {
      it('should return dashboard metrics', async () => {
        const metrics = await getIssueDashboardMetrics();

        expect(metrics).toBeDefined();
        expect(metrics.totalIssues).toBeGreaterThanOrEqual(3);
        expect(metrics.openIssues).toBeDefined();
        expect(metrics.issuesByStatus).toBeDefined();
        expect(metrics.issuesBySeverity).toBeDefined();
      });

      it('should return correct status breakdown', async () => {
        const metrics = await getIssueDashboardMetrics();

        expect(Array.isArray(metrics.issuesByStatus)).toBe(true);
        const submittedCount = metrics.issuesByStatus.find(s => s.status === 'submitted');
        expect(submittedCount).toBeDefined();
      });

      it('should return correct severity breakdown', async () => {
        const metrics = await getIssueDashboardMetrics();

        expect(Array.isArray(metrics.issuesBySeverity)).toBe(true);
        const criticalCount = metrics.issuesBySeverity.find(s => s.severity === 'critical');
        expect(criticalCount).toBeDefined();
      });
    });
  });
});
