/**
 * Issue Dashboard Service
 * Task 8: Dashboard analytics and KPIs for issue tracking system
 */

import { eq, and, gte, count, isNotNull } from 'drizzle-orm';
import { getTableRef, executeDbOperation, isSqlite } from '../db/db-helper';
import { toDateSafe, formatDateFromDb } from '../db/date-utils';
import type {
  IssueStatus,
  IssueSeverity,
  IssuePriority,
  IssueDashboardMetrics,
} from '@/types/issues';

// ============================================
// Constants
// ============================================

const ALL_STATUSES: IssueStatus[] = [
  'draft',
  'submitted',
  'triaged',
  'in_progress',
  'resolved',
  'verified',
  'closed',
];

const ALL_SEVERITIES: IssueSeverity[] = ['critical', 'major', 'minor'];

const ALL_PRIORITIES: IssuePriority[] = ['immediate', 'urgent', 'scheduled', 'backlog'];

const OPEN_STATUSES: IssueStatus[] = ['draft', 'submitted', 'triaged', 'in_progress'];
const RESOLVED_STATUSES: IssueStatus[] = ['resolved', 'verified'];
const CLOSED_STATUSES: IssueStatus[] = ['closed'];

// ============================================
// Helper Functions
// ============================================

/**
 * Get table references for issue-related tables
 */
function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    issueCategories: getTableRef('issueCategories'),
  };
}

/**
 * Get the date N days ago in the correct format for database queries
 */
function getDaysAgo(days: number): Date | string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);

  if (isSqlite()) {
    return date.toISOString();
  }
  return date;
}

/**
 * Get the start of the current week (Monday)
 */
function getStartOfWeek(): Date | string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  if (isSqlite()) {
    return monday.toISOString();
  }
  return monday;
}

/**
 * Format date to YYYY-MM-DD string for grouping
 */
function formatDateForGrouping(value: Date | string | null | undefined): string {
  return formatDateFromDb(value);
}

// ============================================
// Dashboard Metric Functions
// ============================================

/**
 * Get issue counts grouped by status
 */
export async function getIssueCountsByStatus(): Promise<Record<IssueStatus, number>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select({
        status: tables.issues.status,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.status);

    // Initialize with zeros for all statuses
    const counts: Record<IssueStatus, number> = {
      draft: 0,
      submitted: 0,
      triaged: 0,
      in_progress: 0,
      resolved: 0,
      verified: 0,
      closed: 0,
    };

    // Fill in actual counts
    for (const row of result) {
      if (row.status && row.status in counts) {
        counts[row.status as IssueStatus] = row.count;
      }
    }

    return counts;
  });
}

/**
 * Get issue counts grouped by severity
 */
export async function getIssueCountsBySeverity(): Promise<Record<IssueSeverity, number>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select({
        severity: tables.issues.severity,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.severity);

    // Initialize with zeros for all severities
    const counts: Record<IssueSeverity, number> = {
      critical: 0,
      major: 0,
      minor: 0,
    };

    // Fill in actual counts
    for (const row of result) {
      if (row.severity && row.severity in counts) {
        counts[row.severity as IssueSeverity] = row.count;
      }
    }

    return counts;
  });
}

/**
 * Get issue counts grouped by priority
 */
export async function getIssueCountsByPriority(): Promise<Record<IssuePriority | 'unassigned', number>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select({
        priority: tables.issues.priority,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.priority);

    // Initialize with zeros for all priorities plus unassigned
    const counts: Record<IssuePriority | 'unassigned', number> = {
      immediate: 0,
      urgent: 0,
      scheduled: 0,
      backlog: 0,
      unassigned: 0,
    };

    // Fill in actual counts
    for (const row of result) {
      if (row.priority === null) {
        counts.unassigned = row.count;
      } else if (row.priority in counts) {
        counts[row.priority as IssuePriority] = row.count;
      }
    }

    return counts;
  });
}

/**
 * Get issue counts grouped by category with category names
 */
export async function getIssueCountsByCategory(): Promise<Array<{ categoryId: number; categoryName: string; count: number }>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select({
        categoryId: tables.issues.categoryId,
        categoryName: tables.issueCategories.name,
        count: count(),
      })
      .from(tables.issues)
      .leftJoin(tables.issueCategories, eq(tables.issues.categoryId, tables.issueCategories.id))
      .where(isNotNull(tables.issues.categoryId))
      .groupBy(tables.issues.categoryId, tables.issueCategories.name);

    return result.map((row: any) => ({
      categoryId: row.categoryId ?? 0,
      categoryName: row.categoryName ?? 'Uncategorized',
      count: row.count,
    }));
  });
}

/**
 * Get daily trend of issues created over specified number of days
 */
export async function getCreatedTrend(days: number = 30): Promise<Array<{ date: string; count: number }>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const startDate = getDaysAgo(days);

    const result = await db
      .select({
        createdAt: tables.issues.createdAt,
      })
      .from(tables.issues)
      .where(gte(tables.issues.createdAt, startDate));

    // Group by date manually to handle both SQLite and MySQL date formats
    const dateCounts = new Map<string, number>();

    for (const row of result) {
      const dateStr = formatDateForGrouping(row.createdAt);
      dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
    }

    // Generate all dates in the range and fill in counts
    const trend: Array<{ date: string; count: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        count: dateCounts.get(dateStr) || 0,
      });
    }

    return trend;
  });
}

/**
 * Get daily trend of issues resolved over specified number of days
 */
export async function getResolvedTrend(days: number = 30): Promise<Array<{ date: string; count: number }>> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const startDate = getDaysAgo(days);

    // Get issues that have resolvedAt within the date range
    const result = await db
      .select({
        resolvedAt: tables.issues.resolvedAt,
      })
      .from(tables.issues)
      .where(and(
        isNotNull(tables.issues.resolvedAt),
        gte(tables.issues.resolvedAt, startDate)
      ));

    // Group by date manually
    const dateCounts = new Map<string, number>();

    for (const row of result) {
      if (row.resolvedAt) {
        const dateStr = formatDateForGrouping(row.resolvedAt);
        dateCounts.set(dateStr, (dateCounts.get(dateStr) || 0) + 1);
      }
    }

    // Generate all dates in the range and fill in counts
    const trend: Array<{ date: string; count: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        count: dateCounts.get(dateStr) || 0,
      });
    }

    return trend;
  });
}

/**
 * Calculate average resolution time in hours
 * Resolution time = resolvedAt - createdAt for resolved issues
 */
export async function getAverageResolutionTime(): Promise<number | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get all issues with resolvedAt
    const result = await db
      .select({
        createdAt: tables.issues.createdAt,
        resolvedAt: tables.issues.resolvedAt,
      })
      .from(tables.issues)
      .where(isNotNull(tables.issues.resolvedAt));

    if (result.length === 0) {
      return null;
    }

    // Calculate average resolution time
    let totalHours = 0;
    let validCount = 0;

    for (const row of result) {
      const createdAt = toDateSafe(row.createdAt);
      const resolvedAt = toDateSafe(row.resolvedAt);

      // Calculate difference in hours
      const diffMs = resolvedAt.getTime() - createdAt.getTime();
      if (diffMs > 0) {
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours += diffHours;
        validCount++;
      }
    }

    if (validCount === 0) {
      return null;
    }

    // Return average rounded to 2 decimal places
    return Math.round((totalHours / validCount) * 100) / 100;
  });
}

/**
 * Get count of issues resolved this week
 */
export async function getIssuesResolvedThisWeek(): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const weekStart = getStartOfWeek();

    const result = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(and(
        isNotNull(tables.issues.resolvedAt),
        gte(tables.issues.resolvedAt, weekStart)
      ));

    return result[0]?.count || 0;
  });
}

/**
 * Get count of issues created this week
 */
export async function getIssuesCreatedThisWeek(): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const weekStart = getStartOfWeek();

    const result = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(gte(tables.issues.createdAt, weekStart));

    return result[0]?.count || 0;
  });
}

/**
 * Get comprehensive dashboard metrics
 */
export async function getIssueDashboardMetrics(): Promise<IssueDashboardMetrics> {
  // Run all queries in parallel for better performance
  const [
    statusCounts,
    severityCounts,
    priorityCounts,
    categoryCounts,
    createdTrend,
    resolvedTrend,
    avgResolutionTime,
    resolvedThisWeek,
    createdThisWeek,
  ] = await Promise.all([
    getIssueCountsByStatus(),
    getIssueCountsBySeverity(),
    getIssueCountsByPriority(),
    getIssueCountsByCategory(),
    getCreatedTrend(30),
    getResolvedTrend(30),
    getAverageResolutionTime(),
    getIssuesResolvedThisWeek(),
    getIssuesCreatedThisWeek(),
  ]);

  // Calculate totals
  const totalIssues = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const openIssues = OPEN_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);
  const resolvedIssues = RESOLVED_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);
  const closedIssues = CLOSED_STATUSES.reduce((sum, status) => sum + statusCounts[status], 0);

  // Convert status counts to array format for chart compatibility
  const issuesByStatus = ALL_STATUSES.map(status => ({
    status,
    count: statusCounts[status],
  }));

  // Convert severity counts to array format
  const issuesBySeverity = ALL_SEVERITIES.map(severity => ({
    severity,
    count: severityCounts[severity],
  }));

  // Convert priority counts to array format (include unassigned)
  const issuesByPriority = [...ALL_PRIORITIES, 'unassigned' as const].map(priority => ({
    priority,
    count: priorityCounts[priority as IssuePriority | 'unassigned'],
  }));

  // Generate monthly trend from daily data
  const monthlyTrend = generateMonthlyTrend(createdTrend, resolvedTrend);

  return {
    totalIssues,
    openIssues,
    resolvedIssues,
    closedIssues,
    issuesBySeverity,
    issuesByStatus,
    issuesByCategory: categoryCounts,
    issuesByPriority,
    recentIssues: [], // This should be populated by a separate call if needed
    monthlyTrend,
    avgResolutionTime: avgResolutionTime || 0,
    issuesCreatedThisWeek: createdThisWeek,
    issuesResolvedThisWeek: resolvedThisWeek,
  };
}

/**
 * Generate monthly trend data from daily trends
 */
function generateMonthlyTrend(
  createdTrend: Array<{ date: string; count: number }>,
  resolvedTrend: Array<{ date: string; count: number }>
): Array<{ month: string; created: number; resolved: number }> {
  // Group by month
  const monthCreated = new Map<string, number>();
  const monthResolved = new Map<string, number>();

  for (const item of createdTrend) {
    const month = item.date.substring(0, 7); // YYYY-MM
    monthCreated.set(month, (monthCreated.get(month) || 0) + item.count);
  }

  for (const item of resolvedTrend) {
    const month = item.date.substring(0, 7); // YYYY-MM
    monthResolved.set(month, (monthResolved.get(month) || 0) + item.count);
  }

  // Get unique months and sort
  const months = [...new Set([...monthCreated.keys(), ...monthResolved.keys()])].sort();

  return months.map(month => ({
    month,
    created: monthCreated.get(month) || 0,
    resolved: monthResolved.get(month) || 0,
  }));
}

/**
 * Get extended dashboard metrics with additional helper data
 * This combines the standard metrics with extra computed values
 */
export interface ExtendedDashboardMetrics extends IssueDashboardMetrics {
  issuesCreatedThisWeek: number;
  issuesResolvedThisWeek: number;
  statusCounts: Record<IssueStatus, number>;
  severityCounts: Record<IssueSeverity, number>;
  priorityCounts: Record<IssuePriority | 'unassigned', number>;
  createdTrend: Array<{ date: string; count: number }>;
  resolvedTrend: Array<{ date: string; count: number }>;
}

export async function getExtendedDashboardMetrics(): Promise<ExtendedDashboardMetrics> {
  const [
    baseMetrics,
    statusCounts,
    severityCounts,
    priorityCounts,
    createdTrend,
    resolvedTrend,
    createdThisWeek,
    resolvedThisWeek,
  ] = await Promise.all([
    getIssueDashboardMetrics(),
    getIssueCountsByStatus(),
    getIssueCountsBySeverity(),
    getIssueCountsByPriority(),
    getCreatedTrend(30),
    getResolvedTrend(30),
    getIssuesCreatedThisWeek(),
    getIssuesResolvedThisWeek(),
  ]);

  return {
    ...baseMetrics,
    issuesCreatedThisWeek: createdThisWeek,
    issuesResolvedThisWeek: resolvedThisWeek,
    statusCounts,
    severityCounts,
    priorityCounts,
    createdTrend,
    resolvedTrend,
  };
}
