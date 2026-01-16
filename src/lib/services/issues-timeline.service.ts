// Issue Timeline Service
// Task 7: Timeline service that provides unified view of all events for an issue
// Merges audit events and comments into a single chronological timeline

import { eq, asc } from 'drizzle-orm';
import { getTableRef, executeDbOperation, isSqlite } from '../db/db-helper';
import type { IssueAuditEventType } from '@/types/issues';

// ============================================
// Types
// ============================================

/**
 * Unified timeline item representing either an audit event or a comment
 */
export interface TimelineItem {
  id: string; // Prefixed: 'audit-{id}' or 'comment-{id}'
  type: 'audit' | 'comment';
  timestamp: Date | string;
  actor: { id: number; name: string; email: string } | null;
  // For audit events
  eventType?: IssueAuditEventType;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  // For comments
  content?: string;
  isEdited?: boolean;
  mentionedUserIds?: number[];
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get table references for timeline-related tables
 */
function getTimelineTables() {
  return {
    issueAuditEvents: getTableRef('issueAuditEvents'),
    issueComments: getTableRef('issueComments'),
    users: getTableRef('users'),
  };
}

/**
 * Parse JSON field from database
 * SQLite stores JSON as string, MySQL may return object
 */
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return value as T;
}

/**
 * Convert timestamp to comparable value for sorting
 * Handles both Date objects (MySQL) and ISO strings (SQLite)
 */
function getTimestampValue(timestamp: Date | string): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  return new Date(timestamp).getTime();
}

// ============================================
// Timeline Functions
// ============================================

/**
 * Get all audit events for an issue
 * Returns audit events with actor information
 */
export async function getAuditEvents(issueId: number): Promise<TimelineItem[]> {
  return executeDbOperation(async (db) => {
    const tables = getTimelineTables();

    const auditEvents = await db
      .select({
        event: tables.issueAuditEvents,
        actor: {
          id: tables.users.id,
          name: tables.users.name,
          email: tables.users.email,
        },
      })
      .from(tables.issueAuditEvents)
      .leftJoin(tables.users, eq(tables.issueAuditEvents.actorId, tables.users.id))
      .where(eq(tables.issueAuditEvents.issueId, issueId))
      .orderBy(asc(tables.issueAuditEvents.createdAt));

    return auditEvents.map((row: any) => ({
      id: `audit-${row.event.id}`,
      type: 'audit' as const,
      timestamp: row.event.createdAt,
      actor: row.actor,
      eventType: row.event.eventType as IssueAuditEventType,
      oldValue: parseJsonField<Record<string, unknown> | null>(row.event.oldValue, null),
      newValue: parseJsonField<Record<string, unknown> | null>(row.event.newValue, null),
    }));
  });
}

/**
 * Get all comments for an issue as timeline items
 * Returns comments with author information
 */
async function getCommentsAsTimeline(issueId: number): Promise<TimelineItem[]> {
  return executeDbOperation(async (db) => {
    const tables = getTimelineTables();

    const comments = await db
      .select({
        comment: tables.issueComments,
        author: {
          id: tables.users.id,
          name: tables.users.name,
          email: tables.users.email,
        },
      })
      .from(tables.issueComments)
      .leftJoin(tables.users, eq(tables.issueComments.authorId, tables.users.id))
      .where(eq(tables.issueComments.issueId, issueId))
      .orderBy(asc(tables.issueComments.createdAt));

    return comments.map((row: any) => ({
      id: `comment-${row.comment.id}`,
      type: 'comment' as const,
      timestamp: row.comment.createdAt,
      actor: row.author,
      content: row.comment.content,
      isEdited: row.comment.isEdited,
      mentionedUserIds: parseJsonField<number[]>(row.comment.mentionedUserIds, []),
    }));
  });
}

/**
 * Get unified timeline for an issue
 * Merges audit events and comments, sorted by timestamp ascending
 */
export async function getIssueTimeline(issueId: number): Promise<TimelineItem[]> {
  // Fetch both audit events and comments in parallel
  const [auditItems, commentItems] = await Promise.all([
    getAuditEvents(issueId),
    getCommentsAsTimeline(issueId),
  ]);

  // Merge and sort by timestamp
  const allItems = [...auditItems, ...commentItems];

  allItems.sort((a, b) => {
    return getTimestampValue(a.timestamp) - getTimestampValue(b.timestamp);
  });

  return allItems;
}

/**
 * Get the most recent activity for an issue
 * Returns the latest timeline item (either audit event or comment)
 */
export async function getLatestActivity(issueId: number): Promise<TimelineItem | null> {
  const timeline = await getIssueTimeline(issueId);

  if (timeline.length === 0) {
    return null;
  }

  // Return the last item (most recent since timeline is sorted ascending)
  return timeline[timeline.length - 1];
}

/**
 * Get timeline items by type
 * Filters timeline to only return items of specified type
 */
export async function getTimelineByType(
  issueId: number,
  type: 'audit' | 'comment'
): Promise<TimelineItem[]> {
  if (type === 'audit') {
    return getAuditEvents(issueId);
  }
  return getCommentsAsTimeline(issueId);
}

/**
 * Get timeline items count for an issue
 */
export async function getTimelineCount(issueId: number): Promise<{
  total: number;
  auditEvents: number;
  comments: number;
}> {
  const [auditItems, commentItems] = await Promise.all([
    getAuditEvents(issueId),
    getCommentsAsTimeline(issueId),
  ]);

  return {
    total: auditItems.length + commentItems.length,
    auditEvents: auditItems.length,
    comments: commentItems.length,
  };
}
