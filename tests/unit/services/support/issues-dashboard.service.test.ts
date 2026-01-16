/**
 * Issue Dashboard Service Unit Tests
 * Task 8: Dashboard analytics and KPIs tests
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';

let testDb: ReturnType<typeof drizzle> | null = null;

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => Promise.resolve(testDb)),
  isSqlite: vi.fn(() => true),
}));

import {
  getIssueDashboardMetrics,
  getIssueCountsByStatus,
  getIssueCountsBySeverity,
  getIssueCountsByPriority,
  getIssueCountsByCategory,
  getCreatedTrend,
  getResolvedTrend,
  getAverageResolutionTime,
  getIssuesResolvedThisWeek,
  getIssuesCreatedThisWeek,
  getExtendedDashboardMetrics,
} from '@/lib/services/issues-dashboard.service';

describe('Issue Dashboard Service', () => {
  let sqliteDb: ReturnType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite';

    sqliteDb = new Database(':memory:');
    db = drizzle(sqliteDb, { schema });
    testDb = db;

    // Create schema for issue dashboard tests
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS issue_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        required_fields TEXT NOT NULL DEFAULT '[]',
        ai_prompt TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_number TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '{}',
        category_id INTEGER REFERENCES issue_categories(id),
        severity TEXT NOT NULL,
        priority TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        reporter_id INTEGER NOT NULL REFERENCES users(id),
        assignee_id INTEGER REFERENCES users(id),
        ai_validation_passed INTEGER NOT NULL DEFAULT 0,
        ai_validation_skipped INTEGER NOT NULL DEFAULT 0,
        duplicate_of_id INTEGER REFERENCES issues(id),
        resolved_at TEXT,
        verified_at TEXT,
        closed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert test users
    sqliteDb.exec(`
      INSERT INTO users (name, email) VALUES
        ('Test User', 'test@example.com'),
        ('Admin User', 'admin@example.com');
    `);

    // Insert test categories
    sqliteDb.exec(`
      INSERT INTO issue_categories (name, description, type) VALUES
        ('Software Bug', 'Software-related issues', 'software'),
        ('Process Issue', 'Operational issues', 'operational'),
        ('Feature Request', 'New feature requests', 'software');
    `);

    // Insert test issues with various statuses, severities, and priorities
    const now = new Date();
    const today = now.toISOString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // Issue resolved in 24 hours (for avg resolution time test)
    const resolvedTime = new Date(new Date(twoDaysAgo).getTime() + 24 * 60 * 60 * 1000).toISOString();
    const resolvedTime2 = new Date(new Date(fiveDaysAgo).getTime() + 48 * 60 * 60 * 1000).toISOString();

    sqliteDb.exec(`
      -- Draft issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, created_at, updated_at)
      VALUES ('ISS-2026-0001', 'Draft Issue 1', '{"summary":"Draft 1"}', 1, 'minor', NULL, 'draft', 1, '${today}', '${today}');

      -- Submitted issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, created_at, updated_at)
      VALUES ('ISS-2026-0002', 'Submitted Issue 1', '{"summary":"Submitted 1"}', 1, 'major', NULL, 'submitted', 1, '${today}', '${today}');

      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, created_at, updated_at)
      VALUES ('ISS-2026-0003', 'Submitted Issue 2', '{"summary":"Submitted 2"}', 2, 'critical', NULL, 'submitted', 2, '${yesterday}', '${yesterday}');

      -- Triaged issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, created_at, updated_at)
      VALUES ('ISS-2026-0004', 'Triaged Issue 1', '{"summary":"Triaged 1"}', 1, 'major', 'urgent', 'triaged', 1, 2, '${yesterday}', '${yesterday}');

      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, created_at, updated_at)
      VALUES ('ISS-2026-0005', 'Triaged Issue 2', '{"summary":"Triaged 2"}', 3, 'critical', 'immediate', 'triaged', 2, 1, '${twoDaysAgo}', '${twoDaysAgo}');

      -- In Progress issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, created_at, updated_at)
      VALUES ('ISS-2026-0006', 'In Progress Issue 1', '{"summary":"In Progress 1"}', 2, 'major', 'scheduled', 'in_progress', 1, 2, '${twoDaysAgo}', '${twoDaysAgo}');

      -- Resolved issues (with resolved_at for avg calculation)
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, resolved_at, created_at, updated_at)
      VALUES ('ISS-2026-0007', 'Resolved Issue 1', '{"summary":"Resolved 1"}', 1, 'minor', 'backlog', 'resolved', 1, 2, '${resolvedTime}', '${twoDaysAgo}', '${resolvedTime}');

      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, resolved_at, created_at, updated_at)
      VALUES ('ISS-2026-0008', 'Resolved Issue 2', '{"summary":"Resolved 2"}', 2, 'major', 'urgent', 'resolved', 2, 1, '${resolvedTime2}', '${fiveDaysAgo}', '${resolvedTime2}');

      -- Verified issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, resolved_at, verified_at, created_at, updated_at)
      VALUES ('ISS-2026-0009', 'Verified Issue 1', '{"summary":"Verified 1"}', 1, 'critical', 'immediate', 'verified', 1, 2, '${tenDaysAgo}', '${fiveDaysAgo}', '${tenDaysAgo}', '${fiveDaysAgo}');

      -- Closed issues
      INSERT INTO issues (issue_number, title, description, category_id, severity, priority, status, reporter_id, assignee_id, closed_at, created_at, updated_at)
      VALUES ('ISS-2026-0010', 'Closed Issue 1', '{"summary":"Closed 1"}', 3, 'minor', 'backlog', 'closed', 2, 1, '${yesterday}', '${tenDaysAgo}', '${yesterday}');
    `);
  });

  afterAll(() => {
    sqliteDb.close();
  });

  // ============================================
  // Status Counts Tests
  // ============================================
  describe('getIssueCountsByStatus', () => {
    it('should return counts for all statuses', async () => {
      const counts = await getIssueCountsByStatus();

      expect(counts).toHaveProperty('draft');
      expect(counts).toHaveProperty('submitted');
      expect(counts).toHaveProperty('triaged');
      expect(counts).toHaveProperty('in_progress');
      expect(counts).toHaveProperty('resolved');
      expect(counts).toHaveProperty('verified');
      expect(counts).toHaveProperty('closed');
    });

    it('should return correct counts from test data', async () => {
      const counts = await getIssueCountsByStatus();

      expect(counts.draft).toBe(1);
      expect(counts.submitted).toBe(2);
      expect(counts.triaged).toBe(2);
      expect(counts.in_progress).toBe(1);
      expect(counts.resolved).toBe(2);
      expect(counts.verified).toBe(1);
      expect(counts.closed).toBe(1);
    });

    it('should have all counts as numbers', async () => {
      const counts = await getIssueCountsByStatus();

      Object.values(counts).forEach((count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================
  // Severity Counts Tests
  // ============================================
  describe('getIssueCountsBySeverity', () => {
    it('should return counts for all severities', async () => {
      const counts = await getIssueCountsBySeverity();

      expect(counts).toHaveProperty('critical');
      expect(counts).toHaveProperty('major');
      expect(counts).toHaveProperty('minor');
    });

    it('should return correct counts from test data', async () => {
      const counts = await getIssueCountsBySeverity();

      // critical: ISS-0003, ISS-0005, ISS-0009 = 3
      expect(counts.critical).toBe(3);
      // major: ISS-0002, ISS-0004, ISS-0006, ISS-0008 = 4
      expect(counts.major).toBe(4);
      // minor: ISS-0001, ISS-0007, ISS-0010 = 3
      expect(counts.minor).toBe(3);
    });

    it('should have all counts as numbers', async () => {
      const counts = await getIssueCountsBySeverity();

      Object.values(counts).forEach((count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================
  // Priority Counts Tests
  // ============================================
  describe('getIssueCountsByPriority', () => {
    it('should return counts for all priorities including unassigned', async () => {
      const counts = await getIssueCountsByPriority();

      expect(counts).toHaveProperty('immediate');
      expect(counts).toHaveProperty('urgent');
      expect(counts).toHaveProperty('scheduled');
      expect(counts).toHaveProperty('backlog');
      expect(counts).toHaveProperty('unassigned');
    });

    it('should return correct counts from test data', async () => {
      const counts = await getIssueCountsByPriority();

      // immediate: ISS-0005, ISS-0009 = 2
      expect(counts.immediate).toBe(2);
      // urgent: ISS-0004, ISS-0008 = 2
      expect(counts.urgent).toBe(2);
      // scheduled: ISS-0006 = 1
      expect(counts.scheduled).toBe(1);
      // backlog: ISS-0007, ISS-0010 = 2
      expect(counts.backlog).toBe(2);
      // unassigned: ISS-0001, ISS-0002, ISS-0003 = 3
      expect(counts.unassigned).toBe(3);
    });

    it('should have all counts as numbers', async () => {
      const counts = await getIssueCountsByPriority();

      Object.values(counts).forEach((count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================
  // Category Counts Tests
  // ============================================
  describe('getIssueCountsByCategory', () => {
    it('should return array of category counts', async () => {
      const counts = await getIssueCountsByCategory();

      expect(Array.isArray(counts)).toBe(true);
      expect(counts.length).toBeGreaterThan(0);
    });

    it('should include category id, name, and count', async () => {
      const counts = await getIssueCountsByCategory();

      counts.forEach((item) => {
        expect(item).toHaveProperty('categoryId');
        expect(item).toHaveProperty('categoryName');
        expect(item).toHaveProperty('count');
        expect(typeof item.categoryId).toBe('number');
        expect(typeof item.categoryName).toBe('string');
        expect(typeof item.count).toBe('number');
      });
    });

    it('should return correct counts from test data', async () => {
      const counts = await getIssueCountsByCategory();

      // Software Bug (id=1): ISS-0001, ISS-0002, ISS-0004, ISS-0007, ISS-0009 = 5
      const softwareBug = counts.find((c) => c.categoryName === 'Software Bug');
      expect(softwareBug?.count).toBe(5);

      // Process Issue (id=2): ISS-0003, ISS-0006, ISS-0008 = 3
      const processIssue = counts.find((c) => c.categoryName === 'Process Issue');
      expect(processIssue?.count).toBe(3);

      // Feature Request (id=3): ISS-0005, ISS-0010 = 2
      const featureRequest = counts.find((c) => c.categoryName === 'Feature Request');
      expect(featureRequest?.count).toBe(2);
    });
  });

  // ============================================
  // Trend Data Tests
  // ============================================
  describe('getCreatedTrend', () => {
    it('should return 30 days of data by default', async () => {
      const trend = await getCreatedTrend();

      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(30);
    });

    it('should return correct number of days when specified', async () => {
      const trend7 = await getCreatedTrend(7);
      expect(trend7.length).toBe(7);

      const trend14 = await getCreatedTrend(14);
      expect(trend14.length).toBe(14);
    });

    it('should have date and count properties', async () => {
      const trend = await getCreatedTrend();

      trend.forEach((item) => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('count');
        expect(typeof item.date).toBe('string');
        expect(typeof item.count).toBe('number');
        expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it('should have dates in ascending order', async () => {
      const trend = await getCreatedTrend();

      for (let i = 1; i < trend.length; i++) {
        expect(new Date(trend[i].date).getTime()).toBeGreaterThan(
          new Date(trend[i - 1].date).getTime()
        );
      }
    });

    it('should include today as the last date', async () => {
      const trend = await getCreatedTrend();
      const today = new Date().toISOString().split('T')[0];

      expect(trend[trend.length - 1].date).toBe(today);
    });

    it('should have non-negative counts', async () => {
      const trend = await getCreatedTrend();

      trend.forEach((item) => {
        expect(item.count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getResolvedTrend', () => {
    it('should return 30 days of data by default', async () => {
      const trend = await getResolvedTrend();

      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(30);
    });

    it('should have date and count properties', async () => {
      const trend = await getResolvedTrend();

      trend.forEach((item) => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('count');
        expect(typeof item.date).toBe('string');
        expect(typeof item.count).toBe('number');
      });
    });

    it('should have non-negative counts', async () => {
      const trend = await getResolvedTrend();

      trend.forEach((item) => {
        expect(item.count).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ============================================
  // Resolution Time Tests
  // ============================================
  describe('getAverageResolutionTime', () => {
    it('should return a number or null', async () => {
      const avgTime = await getAverageResolutionTime();

      expect(avgTime === null || typeof avgTime === 'number').toBe(true);
    });

    it('should return positive value when resolved issues exist', async () => {
      const avgTime = await getAverageResolutionTime();

      // We have resolved issues in test data
      expect(avgTime).not.toBeNull();
      expect(avgTime).toBeGreaterThan(0);
    });

    it('should return time in hours', async () => {
      const avgTime = await getAverageResolutionTime();

      // Our test data has issues resolved in 24-48 hours
      // The average should be somewhere in that range
      expect(avgTime).toBeGreaterThanOrEqual(24);
      expect(avgTime).toBeLessThanOrEqual(72);
    });
  });

  // ============================================
  // Weekly Stats Tests
  // ============================================
  describe('getIssuesCreatedThisWeek', () => {
    it('should return a number', async () => {
      const count = await getIssuesCreatedThisWeek();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should count issues created this week', async () => {
      const count = await getIssuesCreatedThisWeek();

      // Our test issues were created within the last few days,
      // which should mostly be within the current week
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('getIssuesResolvedThisWeek', () => {
    it('should return a number', async () => {
      const count = await getIssuesResolvedThisWeek();

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Main Dashboard Metrics Tests
  // ============================================
  describe('getIssueDashboardMetrics', () => {
    it('should return complete metrics structure', async () => {
      const metrics = await getIssueDashboardMetrics();

      // Check all required properties exist
      expect(metrics).toHaveProperty('totalIssues');
      expect(metrics).toHaveProperty('openIssues');
      expect(metrics).toHaveProperty('resolvedIssues');
      expect(metrics).toHaveProperty('closedIssues');
      expect(metrics).toHaveProperty('issuesBySeverity');
      expect(metrics).toHaveProperty('issuesByStatus');
      expect(metrics).toHaveProperty('issuesByCategory');
      expect(metrics).toHaveProperty('issuesByPriority');
      expect(metrics).toHaveProperty('recentIssues');
      expect(metrics).toHaveProperty('monthlyTrend');
      expect(metrics).toHaveProperty('avgResolutionTime');
    });

    it('should have correct total issues count', async () => {
      const metrics = await getIssueDashboardMetrics();

      // We inserted 10 issues
      expect(metrics.totalIssues).toBe(10);
    });

    it('should have correct open issues count', async () => {
      const metrics = await getIssueDashboardMetrics();

      // Open = draft (1) + submitted (2) + triaged (2) + in_progress (1) = 6
      expect(metrics.openIssues).toBe(6);
    });

    it('should have correct resolved issues count', async () => {
      const metrics = await getIssueDashboardMetrics();

      // Resolved = resolved (2) + verified (1) = 3
      expect(metrics.resolvedIssues).toBe(3);
    });

    it('should have correct closed issues count', async () => {
      const metrics = await getIssueDashboardMetrics();

      // Closed = 1
      expect(metrics.closedIssues).toBe(1);
    });

    it('should have total = open + resolved + closed', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(metrics.totalIssues).toBe(
        metrics.openIssues + metrics.resolvedIssues + metrics.closedIssues
      );
    });

    it('should have issuesBySeverity as array with all severities', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.issuesBySeverity)).toBe(true);
      expect(metrics.issuesBySeverity.length).toBe(3);

      const severities = metrics.issuesBySeverity.map((s) => s.severity);
      expect(severities).toContain('critical');
      expect(severities).toContain('major');
      expect(severities).toContain('minor');
    });

    it('should have issuesByStatus as array with all statuses', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.issuesByStatus)).toBe(true);
      expect(metrics.issuesByStatus.length).toBe(7);

      const statuses = metrics.issuesByStatus.map((s) => s.status);
      expect(statuses).toContain('draft');
      expect(statuses).toContain('submitted');
      expect(statuses).toContain('triaged');
      expect(statuses).toContain('in_progress');
      expect(statuses).toContain('resolved');
      expect(statuses).toContain('verified');
      expect(statuses).toContain('closed');
    });

    it('should have issuesByPriority including unassigned', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.issuesByPriority)).toBe(true);
      expect(metrics.issuesByPriority.length).toBe(5);

      const priorities = metrics.issuesByPriority.map((p) => p.priority);
      expect(priorities).toContain('immediate');
      expect(priorities).toContain('urgent');
      expect(priorities).toContain('scheduled');
      expect(priorities).toContain('backlog');
      expect(priorities).toContain('unassigned');
    });

    it('should have issuesByCategory as array', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.issuesByCategory)).toBe(true);
      expect(metrics.issuesByCategory.length).toBe(3);

      metrics.issuesByCategory.forEach((item) => {
        expect(item).toHaveProperty('categoryId');
        expect(item).toHaveProperty('categoryName');
        expect(item).toHaveProperty('count');
      });
    });

    it('should have monthlyTrend as array', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.monthlyTrend)).toBe(true);

      metrics.monthlyTrend.forEach((item) => {
        expect(item).toHaveProperty('month');
        expect(item).toHaveProperty('created');
        expect(item).toHaveProperty('resolved');
        expect(item.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it('should have avgResolutionTime as number', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(typeof metrics.avgResolutionTime).toBe('number');
      expect(metrics.avgResolutionTime).toBeGreaterThanOrEqual(0);
    });

    it('should have recentIssues as array', async () => {
      const metrics = await getIssueDashboardMetrics();

      expect(Array.isArray(metrics.recentIssues)).toBe(true);
    });
  });

  // ============================================
  // Extended Dashboard Metrics Tests
  // ============================================
  describe('getExtendedDashboardMetrics', () => {
    it('should return base metrics plus extended properties', async () => {
      const metrics = await getExtendedDashboardMetrics();

      // Base properties
      expect(metrics).toHaveProperty('totalIssues');
      expect(metrics).toHaveProperty('openIssues');
      expect(metrics).toHaveProperty('issuesBySeverity');

      // Extended properties
      expect(metrics).toHaveProperty('issuesCreatedThisWeek');
      expect(metrics).toHaveProperty('issuesResolvedThisWeek');
      expect(metrics).toHaveProperty('statusCounts');
      expect(metrics).toHaveProperty('severityCounts');
      expect(metrics).toHaveProperty('priorityCounts');
      expect(metrics).toHaveProperty('createdTrend');
      expect(metrics).toHaveProperty('resolvedTrend');
    });

    it('should have statusCounts as object with all statuses', async () => {
      const metrics = await getExtendedDashboardMetrics();

      expect(metrics.statusCounts).toHaveProperty('draft');
      expect(metrics.statusCounts).toHaveProperty('submitted');
      expect(metrics.statusCounts).toHaveProperty('triaged');
      expect(metrics.statusCounts).toHaveProperty('in_progress');
      expect(metrics.statusCounts).toHaveProperty('resolved');
      expect(metrics.statusCounts).toHaveProperty('verified');
      expect(metrics.statusCounts).toHaveProperty('closed');
    });

    it('should have severityCounts as object with all severities', async () => {
      const metrics = await getExtendedDashboardMetrics();

      expect(metrics.severityCounts).toHaveProperty('critical');
      expect(metrics.severityCounts).toHaveProperty('major');
      expect(metrics.severityCounts).toHaveProperty('minor');
    });

    it('should have priorityCounts as object with all priorities', async () => {
      const metrics = await getExtendedDashboardMetrics();

      expect(metrics.priorityCounts).toHaveProperty('immediate');
      expect(metrics.priorityCounts).toHaveProperty('urgent');
      expect(metrics.priorityCounts).toHaveProperty('scheduled');
      expect(metrics.priorityCounts).toHaveProperty('backlog');
      expect(metrics.priorityCounts).toHaveProperty('unassigned');
    });

    it('should have trend arrays with 30 days', async () => {
      const metrics = await getExtendedDashboardMetrics();

      expect(metrics.createdTrend.length).toBe(30);
      expect(metrics.resolvedTrend.length).toBe(30);
    });
  });

  // ============================================
  // Edge Cases Tests
  // ============================================
  describe('Edge Cases', () => {
    it('should handle zero counts gracefully', async () => {
      const counts = await getIssueCountsByStatus();

      // All values should be defined even if zero
      Object.keys(counts).forEach((key) => {
        expect(counts[key as keyof typeof counts]).toBeDefined();
      });
    });

    it('should handle empty trend data', async () => {
      // Request trend for very short period
      const trend = await getCreatedTrend(1);

      expect(Array.isArray(trend)).toBe(true);
      expect(trend.length).toBe(1);
    });

    it('should handle concurrent metric requests', async () => {
      // Run multiple metrics requests in parallel
      const [metrics1, metrics2, metrics3] = await Promise.all([
        getIssueDashboardMetrics(),
        getIssueDashboardMetrics(),
        getIssueDashboardMetrics(),
      ]);

      // All should return same totals
      expect(metrics1.totalIssues).toBe(metrics2.totalIssues);
      expect(metrics2.totalIssues).toBe(metrics3.totalIssues);
    });
  });
});
