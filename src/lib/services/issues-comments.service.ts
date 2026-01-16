// Issue Comments Service
// Task 6: Comments service for issue discussions
// Follows the template module pattern for database operations

import { eq, and, asc, count, inArray } from 'drizzle-orm';
import { getNow } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation, isSqlite } from '../db/db-helper';
import type {
  IssueComment,
  IssueCommentCreate,
  IssueAuditEventType,
  IssueNotificationType,
} from '@/types/issues';

// ============================================
// Helper Functions
// ============================================

/**
 * Get table references for issue comment-related tables
 */
function getCommentTables() {
  return {
    issues: getTableRef('issues'),
    issueComments: getTableRef('issueComments'),
    issueAttachments: getTableRef('issueAttachments'),
    issueAuditEvents: getTableRef('issueAuditEvents'),
    issueNotifications: getTableRef('issueNotifications'),
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
 * Stringify JSON for database storage
 * SQLite needs string, MySQL can handle objects
 */
function toJsonField<T>(value: T): T | string {
  if (isSqlite()) {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Create an audit event for an issue
 */
async function createAuditEvent(
  db: any,
  tables: ReturnType<typeof getCommentTables>,
  issueId: number,
  eventType: IssueAuditEventType,
  actorId: number,
  oldValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null
): Promise<void> {
  await db.insert(tables.issueAuditEvents).values({
    issueId,
    eventType,
    actorId,
    oldValue: oldValue ? toJsonField(oldValue) : null,
    newValue: newValue ? toJsonField(newValue) : null,
    createdAt: getNow(),
  });
}

/**
 * Create a notification for a user
 */
async function createNotification(
  db: any,
  tables: ReturnType<typeof getCommentTables>,
  userId: number,
  issueId: number,
  type: IssueNotificationType,
  message: string
): Promise<void> {
  await db.insert(tables.issueNotifications).values({
    userId,
    issueId,
    type,
    message,
    isRead: false,
    emailSent: false,
    createdAt: getNow(),
  });
}

// ============================================
// Mention Parsing Functions
// ============================================

/**
 * Extract @username mentions from content
 * Uses regex pattern to find @mentions
 */
export function parseMentions(content: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    // Avoid duplicates
    if (!mentions.includes(username)) {
      mentions.push(username);
    }
  }

  return mentions;
}

/**
 * Resolve usernames to user IDs
 * Performs case-insensitive lookup of users by name
 */
export async function resolveUserIds(usernames: string[]): Promise<Map<string, number>> {
  if (usernames.length === 0) {
    return new Map();
  }

  return executeDbOperation(async (db) => {
    const tables = getCommentTables();
    const userMap = new Map<string, number>();

    // Get all users and filter by name (case-insensitive)
    const users = await db
      .select({
        id: tables.users.id,
        name: tables.users.name,
      })
      .from(tables.users);

    // Filter case-insensitively
    const lowercaseUsernames = usernames.map((u) => u.toLowerCase());
    for (const user of users) {
      if (lowercaseUsernames.includes(user.name.toLowerCase())) {
        userMap.set(user.name.toLowerCase(), user.id);
      }
    }

    return userMap;
  });
}

// ============================================
// Comment CRUD Operations
// ============================================

/**
 * List all comments for an issue
 * Returns comments sorted by createdAt ascending with author info
 */
export async function listComments(issueId: number): Promise<IssueComment[]> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    // Get comments with author info
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

    // Get comment IDs for attachment count query
    const commentIds = comments.map((c: any) => c.comment.id);

    // Get attachment counts for comments
    const attachmentCounts = commentIds.length > 0
      ? await db
          .select({
            commentId: tables.issueAttachments.commentId,
            count: count(),
          })
          .from(tables.issueAttachments)
          .where(
            and(
              inArray(tables.issueAttachments.commentId, commentIds),
              eq(tables.issueAttachments.isDeleted, false)
            )
          )
          .groupBy(tables.issueAttachments.commentId)
      : [];

    const attachmentCountMap = new Map<number, number>();
    for (const row of attachmentCounts) {
      if (row.commentId) {
        attachmentCountMap.set(row.commentId, row.count);
      }
    }

    // Map results
    return comments.map((row: any) => ({
      ...row.comment,
      mentionedUserIds: parseJsonField<number[]>(row.comment.mentionedUserIds, []),
      author: row.author,
      attachmentCount: attachmentCountMap.get(row.comment.id) || 0,
    })) as IssueComment[];
  });
}

/**
 * Create a new comment on an issue
 * Extracts @mentions and creates notifications
 */
export async function createComment(
  issueId: number,
  data: IssueCommentCreate,
  authorId: number
): Promise<IssueComment | null> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    // Validate issue exists
    const issue = await db
      .select({
        id: tables.issues.id,
        issueNumber: tables.issues.issueNumber,
        title: tables.issues.title,
        reporterId: tables.issues.reporterId,
        assigneeId: tables.issues.assigneeId,
      })
      .from(tables.issues)
      .where(eq(tables.issues.id, issueId))
      .limit(1);

    if (issue.length === 0) {
      throw new Error('Issue not found');
    }

    const issueData = issue[0];

    // Extract @mentions from content
    const mentionedUsernames = parseMentions(data.content);
    const userIdMap = await resolveUserIds(mentionedUsernames);
    const mentionedUserIds = Array.from(userIdMap.values());

    const now = getNow();
    const insertData = {
      issueId,
      authorId,
      content: data.content,
      mentionedUserIds: toJsonField(mentionedUserIds),
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.issueComments).values(insertData);
    const commentId = getInsertId(result);

    // Create 'commented' audit event
    await createAuditEvent(
      db,
      tables,
      issueId,
      'commented',
      authorId,
      null,
      { commentId, content: data.content }
    );

    // Create notifications for mentioned users
    for (const userId of mentionedUserIds) {
      // Don't notify the author if they mentioned themselves
      if (userId !== authorId) {
        await createNotification(
          db,
          tables,
          userId,
          issueId,
          'mentioned',
          `You were mentioned in a comment on ${issueData.issueNumber}: ${issueData.title}`
        );
      }
    }

    // Create notification for reporter (if not the author and not already mentioned)
    if (issueData.reporterId !== authorId && !mentionedUserIds.includes(issueData.reporterId)) {
      await createNotification(
        db,
        tables,
        issueData.reporterId,
        issueId,
        'commented',
        `New comment on your issue ${issueData.issueNumber}: ${issueData.title}`
      );
    }

    // Create notification for assignee (if exists, not the author, not the reporter, and not mentioned)
    if (
      issueData.assigneeId &&
      issueData.assigneeId !== authorId &&
      issueData.assigneeId !== issueData.reporterId &&
      !mentionedUserIds.includes(issueData.assigneeId)
    ) {
      await createNotification(
        db,
        tables,
        issueData.assigneeId,
        issueId,
        'commented',
        `New comment on assigned issue ${issueData.issueNumber}: ${issueData.title}`
      );
    }

    // Get the created comment with author info
    return getComment(commentId);
  });
}

/**
 * Get a single comment by ID
 */
export async function getComment(commentId: number): Promise<IssueComment | null> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    const result = await db
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
      .where(eq(tables.issueComments.id, commentId))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];

    // Get attachment count
    const attachmentCount = await db
      .select({ count: count() })
      .from(tables.issueAttachments)
      .where(
        and(
          eq(tables.issueAttachments.commentId, commentId),
          eq(tables.issueAttachments.isDeleted, false)
        )
      );

    return {
      ...row.comment,
      mentionedUserIds: parseJsonField<number[]>(row.comment.mentionedUserIds, []),
      author: row.author,
      attachmentCount: attachmentCount[0]?.count || 0,
    } as IssueComment;
  });
}

/**
 * Update an existing comment
 * Only the author can edit their own comment
 */
export async function updateComment(
  commentId: number,
  content: string,
  actorId: number
): Promise<IssueComment | null> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    // Verify comment exists and get its current data
    const existing = await db
      .select()
      .from(tables.issueComments)
      .where(eq(tables.issueComments.id, commentId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Comment not found');
    }

    const existingComment = existing[0];

    // Only allow author to edit their own comment
    if (existingComment.authorId !== actorId) {
      throw new Error('Only the author can edit this comment');
    }

    // Re-extract @mentions from new content
    const mentionedUsernames = parseMentions(content);
    const userIdMap = await resolveUserIds(mentionedUsernames);
    const mentionedUserIds = Array.from(userIdMap.values());

    const now = getNow();
    const updateData = {
      content,
      mentionedUserIds: toJsonField(mentionedUserIds),
      isEdited: true,
      updatedAt: now,
    };

    await db
      .update(tables.issueComments)
      .set(updateData)
      .where(eq(tables.issueComments.id, commentId));

    return getComment(commentId);
  });
}

/**
 * Delete a comment
 * Only the author or admin can delete
 * Also marks related attachments as deleted
 */
export async function deleteComment(
  commentId: number,
  actorId: number,
  isAdmin: boolean = false
): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    // Verify comment exists
    const existing = await db
      .select()
      .from(tables.issueComments)
      .where(eq(tables.issueComments.id, commentId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Comment not found');
    }

    const existingComment = existing[0];

    // Only allow author or admin to delete
    if (existingComment.authorId !== actorId && !isAdmin) {
      throw new Error('Only the author or admin can delete this comment');
    }

    // Create audit event for deletion before deleting
    await createAuditEvent(
      db,
      tables,
      existingComment.issueId,
      'commented', // Using 'commented' event type with deletion indicator in value
      actorId,
      { commentId, content: existingComment.content, action: 'deleted' },
      null
    );

    // Mark related attachments as deleted (soft delete)
    await db
      .update(tables.issueAttachments)
      .set({ isDeleted: true })
      .where(eq(tables.issueAttachments.commentId, commentId));

    // Delete the comment
    await db.delete(tables.issueComments).where(eq(tables.issueComments.id, commentId));

    return true;
  });
}

/**
 * Get comment count for an issue
 */
export async function getCommentCount(issueId: number): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getCommentTables();

    const result = await db
      .select({ count: count() })
      .from(tables.issueComments)
      .where(eq(tables.issueComments.issueId, issueId));

    return result[0]?.count || 0;
  });
}
