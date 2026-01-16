// Issue Tracker Service
// Core CRUD operations for issue tracking system
// Follows the template module pattern for database operations

import { eq, and, like, desc, asc, sql, count, inArray, or } from 'drizzle-orm';
import { getNow } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation, isSqlite } from '../db/db-helper';
import type {
  Issue,
  IssueCategory,
  IssueTag,
  IssueCreate,
  IssueUpdate,
  IssueCategoryCreate,
  IssueCategoryUpdate,
  IssueTagCreate,
  IssueListFilters,
  IssueStatus,
  IssueDescription,
  IssueAuditEventType,
} from '@/types/issues';

// ============================================
// Helper Functions
// ============================================

/**
 * Get table references for all issue-related tables
 */
function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    issueCategories: getTableRef('issueCategories'),
    issueTags: getTableRef('issueTags'),
    issueTagLinks: getTableRef('issueTagLinks'),
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
 * Generate unique issue number in format "ISS-YYYY-NNNN"
 */
export async function generateIssueNumber(): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const year = new Date().getFullYear();
    const prefix = `ISS-${year}-`;

    // Get the highest issue number for this year
    const result = await db
      .select({ issueNumber: tables.issues.issueNumber })
      .from(tables.issues)
      .where(like(tables.issues.issueNumber, `${prefix}%`))
      .orderBy(desc(tables.issues.issueNumber))
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0 && result[0].issueNumber) {
      const currentNumber = parseInt(result[0].issueNumber.replace(prefix, ''), 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  });
}

// ============================================
// Issue Audit Events
// ============================================

/**
 * Create an audit event for an issue
 */
async function createAuditEvent(
  db: any,
  tables: ReturnType<typeof getIssueTables>,
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

// ============================================
// Issue Categories CRUD
// ============================================

export interface IssueCategoryListFilters {
  isActive?: boolean;
  type?: 'software' | 'operational';
  search?: string;
}

/**
 * List issue categories with optional filters
 */
export async function listIssueCategories(filters?: IssueCategoryListFilters): Promise<IssueCategory[]> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const conditions: any[] = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(tables.issueCategories.isActive, filters.isActive));
    }
    if (filters?.type) {
      conditions.push(eq(tables.issueCategories.type, filters.type));
    }
    if (filters?.search) {
      conditions.push(like(tables.issueCategories.name, `%${filters.search}%`));
    }

    const categories = await db
      .select()
      .from(tables.issueCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tables.issueCategories.name));

    // Get issue counts for each category
    const issueCounts = await db
      .select({
        categoryId: tables.issues.categoryId,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.categoryId);

    const countMap = new Map<number, number>();
    for (const row of issueCounts) {
      if (row.categoryId) {
        countMap.set(row.categoryId, row.count);
      }
    }

    return categories.map((cat: any) => ({
      ...cat,
      requiredFields: parseJsonField<string[]>(cat.requiredFields, []),
      issueCount: countMap.get(cat.id) || 0,
    }));
  });
}

/**
 * Get a single issue category by ID
 */
export async function getIssueCategory(id: number): Promise<IssueCategory | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select()
      .from(tables.issueCategories)
      .where(eq(tables.issueCategories.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const cat = result[0];

    // Get issue count
    const countResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(eq(tables.issues.categoryId, id));

    return {
      ...cat,
      requiredFields: parseJsonField<string[]>(cat.requiredFields, []),
      issueCount: countResult[0]?.count || 0,
    };
  });
}

/**
 * Create a new issue category
 */
export async function createIssueCategory(data: IssueCategoryCreate): Promise<IssueCategory | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check for duplicate name
    const existing = await db
      .select()
      .from(tables.issueCategories)
      .where(eq(tables.issueCategories.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Category with name "${data.name}" already exists`);
    }

    const now = getNow();
    const insertData = {
      name: data.name,
      description: data.description || null,
      type: data.type,
      requiredFields: toJsonField(data.requiredFields || []),
      aiPrompt: data.aiPrompt || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.issueCategories).values(insertData);
    const insertId = getInsertId(result);

    return getIssueCategory(insertId);
  });
}

/**
 * Update an issue category
 */
export async function updateIssueCategory(id: number, data: IssueCategoryUpdate): Promise<IssueCategory | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check if category exists
    const existing = await db
      .select()
      .from(tables.issueCategories)
      .where(eq(tables.issueCategories.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Category not found');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: getNow(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.requiredFields !== undefined) updateData.requiredFields = toJsonField(data.requiredFields);
    if (data.aiPrompt !== undefined) updateData.aiPrompt = data.aiPrompt;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db.update(tables.issueCategories).set(updateData).where(eq(tables.issueCategories.id, id));

    return getIssueCategory(id);
  });
}

/**
 * Delete an issue category
 * Fails if there are existing issues in this category
 */
export async function deleteIssueCategory(id: number): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check for existing issues
    const issueCount = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(eq(tables.issues.categoryId, id));

    if (issueCount[0]?.count > 0) {
      throw new Error('Cannot delete category with existing issues');
    }

    await db.delete(tables.issueCategories).where(eq(tables.issueCategories.id, id));
    return true;
  });
}

// ============================================
// Issue Tags CRUD
// ============================================

/**
 * List all issue tags
 */
export async function listIssueTags(): Promise<IssueTag[]> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    return db
      .select()
      .from(tables.issueTags)
      .orderBy(asc(tables.issueTags.name));
  });
}

/**
 * Get a single issue tag by ID
 */
export async function getIssueTag(id: number): Promise<IssueTag | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select()
      .from(tables.issueTags)
      .where(eq(tables.issueTags.id, id))
      .limit(1);

    return result[0] || null;
  });
}

/**
 * Create a new issue tag
 */
export async function createIssueTag(data: IssueTagCreate): Promise<IssueTag | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check for duplicate name
    const existing = await db
      .select()
      .from(tables.issueTags)
      .where(eq(tables.issueTags.name, data.name))
      .limit(1);

    if (existing.length > 0) {
      throw new Error(`Tag with name "${data.name}" already exists`);
    }

    const result = await db.insert(tables.issueTags).values({
      name: data.name,
      color: data.color,
      createdAt: getNow(),
    });

    const insertId = getInsertId(result);
    return getIssueTag(insertId);
  });
}

/**
 * Delete an issue tag and its links
 */
export async function deleteIssueTag(id: number): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Delete tag links first (cascade should handle this, but be explicit)
    await db.delete(tables.issueTagLinks).where(eq(tables.issueTagLinks.tagId, id));

    // Delete the tag
    await db.delete(tables.issueTags).where(eq(tables.issueTags.id, id));
    return true;
  });
}

// ============================================
// Issues CRUD
// ============================================

/**
 * List issues with filters and pagination
 */
export async function listIssues(filters?: IssueListFilters): Promise<{
  items: Issue[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(tables.issues.status, filters.status));
    }
    if (filters?.severity) {
      conditions.push(eq(tables.issues.severity, filters.severity));
    }
    if (filters?.priority) {
      conditions.push(eq(tables.issues.priority, filters.priority));
    }
    if (filters?.categoryId) {
      conditions.push(eq(tables.issues.categoryId, filters.categoryId));
    }
    if (filters?.assigneeId) {
      conditions.push(eq(tables.issues.assigneeId, filters.assigneeId));
    }
    if (filters?.reporterId) {
      conditions.push(eq(tables.issues.reporterId, filters.reporterId));
    }
    if (filters?.search) {
      conditions.push(
        or(
          like(tables.issues.title, `%${filters.search}%`),
          like(tables.issues.issueNumber, `%${filters.search}%`)
        )
      );
    }

    // Apply pagination
    const limit = filters?.limit || 50;
    const page = filters?.page || 1;
    const offset = (page - 1) * limit;

    // If filtering by tags, we need to get issue IDs first
    if (filters?.tagIds && filters.tagIds.length > 0) {
      const taggedIssues = await db
        .select({ issueId: tables.issueTagLinks.issueId })
        .from(tables.issueTagLinks)
        .where(inArray(tables.issueTagLinks.tagId, filters.tagIds));
      const issueIdsFromTags = taggedIssues.map((r: any) => r.issueId) as number[];
      if (issueIdsFromTags.length === 0) {
        // No issues match the tag filter
        return { items: [], total: 0, page, limit, totalPages: 0 };
      }
      conditions.push(inArray(tables.issues.id, issueIdsFromTags));
    }

    // Query issues with joins to category, reporter, and assignee
    const issues = await db
      .select({
        issue: tables.issues,
        category: tables.issueCategories,
        reporter: {
          id: tables.users.id,
          name: tables.users.name,
          email: tables.users.email,
        },
      })
      .from(tables.issues)
      .leftJoin(tables.issueCategories, eq(tables.issues.categoryId, tables.issueCategories.id))
      .leftJoin(tables.users, eq(tables.issues.reporterId, tables.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.issues.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get assignee info separately (to avoid complex multi-join)
    const issueIds = issues.map((r: any) => r.issue.id);
    const assigneeIds = issues
      .map((r: any) => r.issue.assigneeId)
      .filter((id: number | null) => id !== null);

    const assignees = assigneeIds.length > 0
      ? await db
          .select({
            id: tables.users.id,
            name: tables.users.name,
            email: tables.users.email,
          })
          .from(tables.users)
          .where(inArray(tables.users.id, assigneeIds))
      : [];

    const assigneeMap = new Map<number, { id: number; name: string; email: string }>();
    for (const a of assignees) {
      assigneeMap.set(a.id, a);
    }

    // Get tags for all issues
    const tagLinks = issueIds.length > 0
      ? await db
          .select({
            issueId: tables.issueTagLinks.issueId,
            tag: tables.issueTags,
          })
          .from(tables.issueTagLinks)
          .innerJoin(tables.issueTags, eq(tables.issueTagLinks.tagId, tables.issueTags.id))
          .where(inArray(tables.issueTagLinks.issueId, issueIds))
      : [];

    const tagsMap = new Map<number, IssueTag[]>();
    for (const link of tagLinks) {
      if (!tagsMap.has(link.issueId)) {
        tagsMap.set(link.issueId, []);
      }
      tagsMap.get(link.issueId)!.push(link.tag);
    }

    // Get attachment and comment counts
    const attachmentCounts = issueIds.length > 0
      ? await db
          .select({
            issueId: tables.issueAttachments.issueId,
            count: count(),
          })
          .from(tables.issueAttachments)
          .where(and(
            inArray(tables.issueAttachments.issueId, issueIds),
            eq(tables.issueAttachments.isDeleted, false)
          ))
          .groupBy(tables.issueAttachments.issueId)
      : [];

    const attachmentCountMap = new Map<number, number>();
    for (const row of attachmentCounts) {
      if (row.issueId) {
        attachmentCountMap.set(row.issueId, row.count);
      }
    }

    const commentCounts = issueIds.length > 0
      ? await db
          .select({
            issueId: tables.issueComments.issueId,
            count: count(),
          })
          .from(tables.issueComments)
          .where(inArray(tables.issueComments.issueId, issueIds))
          .groupBy(tables.issueComments.issueId)
      : [];

    const commentCountMap = new Map<number, number>();
    for (const row of commentCounts) {
      commentCountMap.set(row.issueId, row.count);
    }

    // Map results
    const items = issues.map((row: any) => ({
      ...row.issue,
      description: parseJsonField<IssueDescription>(row.issue.description, { summary: '' }),
      category: row.category,
      reporter: row.reporter,
      assignee: row.issue.assigneeId ? assigneeMap.get(row.issue.assigneeId) || null : null,
      tags: tagsMap.get(row.issue.id) || [],
      attachmentCount: attachmentCountMap.get(row.issue.id) || 0,
      commentCount: commentCountMap.get(row.issue.id) || 0,
    })) as Issue[];

    return {
      items,
      total: totalResult[0]?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((totalResult[0]?.count || 0) / limit),
    };
  });
}

/**
 * Get a single issue by ID with full relations
 */
export async function getIssue(id: number): Promise<Issue | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get issue with category and reporter
    const result = await db
      .select({
        issue: tables.issues,
        category: tables.issueCategories,
        reporter: {
          id: tables.users.id,
          name: tables.users.name,
          email: tables.users.email,
        },
      })
      .from(tables.issues)
      .leftJoin(tables.issueCategories, eq(tables.issues.categoryId, tables.issueCategories.id))
      .leftJoin(tables.users, eq(tables.issues.reporterId, tables.users.id))
      .where(eq(tables.issues.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];

    // Get assignee if exists
    let assignee = null;
    if (row.issue.assigneeId) {
      const assigneeResult = await db
        .select({
          id: tables.users.id,
          name: tables.users.name,
          email: tables.users.email,
        })
        .from(tables.users)
        .where(eq(tables.users.id, row.issue.assigneeId))
        .limit(1);
      assignee = assigneeResult[0] || null;
    }

    // Get duplicate issue if exists
    let duplicateOf = null;
    if (row.issue.duplicateOfId) {
      const dupResult = await db
        .select()
        .from(tables.issues)
        .where(eq(tables.issues.id, row.issue.duplicateOfId))
        .limit(1);
      if (dupResult.length > 0) {
        duplicateOf = {
          ...dupResult[0],
          description: parseJsonField<IssueDescription>(dupResult[0].description, { summary: '' }),
        };
      }
    }

    // Get tags
    const tagLinks = await db
      .select({ tag: tables.issueTags })
      .from(tables.issueTagLinks)
      .innerJoin(tables.issueTags, eq(tables.issueTagLinks.tagId, tables.issueTags.id))
      .where(eq(tables.issueTagLinks.issueId, id));

    const tags = tagLinks.map((link: any) => link.tag);

    // Get attachment count
    const attachmentCount = await db
      .select({ count: count() })
      .from(tables.issueAttachments)
      .where(and(
        eq(tables.issueAttachments.issueId, id),
        eq(tables.issueAttachments.isDeleted, false)
      ));

    // Get comment count
    const commentCount = await db
      .select({ count: count() })
      .from(tables.issueComments)
      .where(eq(tables.issueComments.issueId, id));

    return {
      ...row.issue,
      description: parseJsonField<IssueDescription>(row.issue.description, { summary: '' }),
      category: row.category,
      reporter: row.reporter,
      assignee,
      duplicateOf,
      tags,
      attachmentCount: attachmentCount[0]?.count || 0,
      commentCount: commentCount[0]?.count || 0,
    } as Issue;
  });
}

/**
 * Create a new issue
 * @param data Issue creation data
 * @param reporterId User ID of the reporter
 * @param status Initial status ('draft' or 'submitted')
 */
export async function createIssue(
  data: IssueCreate,
  reporterId: number,
  status: IssueStatus = 'draft'
): Promise<Issue | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Validate category exists
    if (data.categoryId) {
      const category = await db
        .select()
        .from(tables.issueCategories)
        .where(eq(tables.issueCategories.id, data.categoryId))
        .limit(1);

      if (category.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Generate issue number
    const issueNumber = await generateIssueNumber();

    const now = getNow();
    const insertData = {
      issueNumber,
      title: data.title,
      description: toJsonField(data.description),
      categoryId: data.categoryId || null,
      severity: data.severity,
      priority: null as string | null, // Set during triage
      status,
      reporterId,
      assigneeId: null as number | null,
      aiValidationPassed: false,
      aiValidationSkipped: false,
      duplicateOfId: null as number | null,
      resolvedAt: null as Date | string | null,
      verifiedAt: null as Date | string | null,
      closedAt: null as Date | string | null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.issues).values(insertData);
    const insertId = getInsertId(result);

    // Add tag links if provided
    if (data.tagIds && data.tagIds.length > 0) {
      for (const tagId of data.tagIds) {
        await db.insert(tables.issueTagLinks).values({
          issueId: insertId,
          tagId,
          createdAt: now,
        });
      }
    }

    // Create audit event
    await createAuditEvent(
      db,
      tables,
      insertId,
      'created',
      reporterId,
      null,
      { status, severity: data.severity, title: data.title }
    );

    return getIssue(insertId);
  });
}

/**
 * Update an issue
 * Creates audit events for status changes, assignments, etc.
 */
export async function updateIssue(
  id: number,
  data: IssueUpdate,
  actorId: number
): Promise<Issue | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get existing issue
    const existing = await db
      .select()
      .from(tables.issues)
      .where(eq(tables.issues.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Issue not found');
    }

    const existingIssue = existing[0];
    const now = getNow();

    // Validate category if provided
    if (data.categoryId !== undefined && data.categoryId !== null) {
      const category = await db
        .select()
        .from(tables.issueCategories)
        .where(eq(tables.issueCategories.id, data.categoryId))
        .limit(1);

      if (category.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Validate assignee if provided
    if (data.assigneeId !== undefined && data.assigneeId !== null) {
      const assignee = await db
        .select()
        .from(tables.users)
        .where(eq(tables.users.id, data.assigneeId))
        .limit(1);

      if (assignee.length === 0) {
        throw new Error('Assignee not found');
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = toJsonField(data.description);
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Set timestamp fields based on status
      if (data.status === 'resolved') {
        updateData.resolvedAt = now;
      } else if (data.status === 'verified') {
        updateData.verifiedAt = now;
      } else if (data.status === 'closed') {
        updateData.closedAt = now;
      }
    }
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;

    // Update the issue
    await db.update(tables.issues).set(updateData).where(eq(tables.issues.id, id));

    // Create audit events for tracked changes
    const oldDesc = parseJsonField<IssueDescription>(existingIssue.description, { summary: '' });

    // Status change
    if (data.status !== undefined && data.status !== existingIssue.status) {
      await createAuditEvent(
        db,
        tables,
        id,
        'status_changed',
        actorId,
        { status: existingIssue.status },
        { status: data.status }
      );
    }

    // Assignment change
    if (data.assigneeId !== undefined && data.assigneeId !== existingIssue.assigneeId) {
      await createAuditEvent(
        db,
        tables,
        id,
        'assigned',
        actorId,
        { assigneeId: existingIssue.assigneeId },
        { assigneeId: data.assigneeId }
      );
    }

    // Priority change
    if (data.priority !== undefined && data.priority !== existingIssue.priority) {
      await createAuditEvent(
        db,
        tables,
        id,
        'priority_changed',
        actorId,
        { priority: existingIssue.priority },
        { priority: data.priority }
      );
    }

    // Severity change
    if (data.severity !== undefined && data.severity !== existingIssue.severity) {
      await createAuditEvent(
        db,
        tables,
        id,
        'severity_changed',
        actorId,
        { severity: existingIssue.severity },
        { severity: data.severity }
      );
    }

    // General edit (for title, description, category changes)
    if (
      (data.title !== undefined && data.title !== existingIssue.title) ||
      (data.description !== undefined && JSON.stringify(data.description) !== JSON.stringify(oldDesc)) ||
      (data.categoryId !== undefined && data.categoryId !== existingIssue.categoryId)
    ) {
      await createAuditEvent(
        db,
        tables,
        id,
        'edited',
        actorId,
        {
          title: existingIssue.title,
          description: oldDesc,
          categoryId: existingIssue.categoryId,
        },
        {
          title: data.title || existingIssue.title,
          description: data.description || oldDesc,
          categoryId: data.categoryId !== undefined ? data.categoryId : existingIssue.categoryId,
        }
      );
    }

    // Update tags if provided
    if (data.tagIds !== undefined) {
      // Remove existing tag links
      await db.delete(tables.issueTagLinks).where(eq(tables.issueTagLinks.issueId, id));

      // Add new tag links
      if (data.tagIds.length > 0) {
        for (const tagId of data.tagIds) {
          await db.insert(tables.issueTagLinks).values({
            issueId: id,
            tagId,
            createdAt: now,
          });
        }
      }
    }

    return getIssue(id);
  });
}

/**
 * Delete an issue and all related records
 */
export async function deleteIssue(id: number, actorId: number): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check if issue exists
    const existing = await db
      .select()
      .from(tables.issues)
      .where(eq(tables.issues.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Issue not found');
    }

    // Delete related records (cascade should handle most, but be explicit)
    // Order matters due to foreign key constraints
    await db.delete(tables.issueNotifications).where(eq(tables.issueNotifications.issueId, id));
    await db.delete(tables.issueAuditEvents).where(eq(tables.issueAuditEvents.issueId, id));
    await db.delete(tables.issueAttachments).where(eq(tables.issueAttachments.issueId, id));
    await db.delete(tables.issueComments).where(eq(tables.issueComments.issueId, id));
    await db.delete(tables.issueTagLinks).where(eq(tables.issueTagLinks.issueId, id));

    // Delete the issue itself
    await db.delete(tables.issues).where(eq(tables.issues.id, id));

    return true;
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Mark AI validation as passed or skipped
 */
export async function updateAIValidation(
  id: number,
  passed: boolean,
  skipped: boolean
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    await db
      .update(tables.issues)
      .set({
        aiValidationPassed: passed,
        aiValidationSkipped: skipped,
        updatedAt: getNow(),
      })
      .where(eq(tables.issues.id, id));
  });
}

/**
 * Mark an issue as a duplicate of another
 */
export async function markAsDuplicate(
  issueId: number,
  duplicateOfId: number,
  actorId: number
): Promise<Issue | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Verify both issues exist
    const [issue, duplicateOf] = await Promise.all([
      db.select().from(tables.issues).where(eq(tables.issues.id, issueId)).limit(1),
      db.select().from(tables.issues).where(eq(tables.issues.id, duplicateOfId)).limit(1),
    ]);

    if (issue.length === 0) {
      throw new Error('Issue not found');
    }
    if (duplicateOf.length === 0) {
      throw new Error('Duplicate target issue not found');
    }
    if (issueId === duplicateOfId) {
      throw new Error('Issue cannot be a duplicate of itself');
    }

    const now = getNow();

    // Update issue
    await db
      .update(tables.issues)
      .set({
        duplicateOfId,
        status: 'closed',
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(tables.issues.id, issueId));

    // Create audit event
    await createAuditEvent(
      db,
      tables,
      issueId,
      'merged',
      actorId,
      null,
      { duplicateOfId, duplicateOfNumber: duplicateOf[0].issueNumber }
    );

    return getIssue(issueId);
  });
}

/**
 * Get issue by issue number
 */
export async function getIssueByNumber(issueNumber: string): Promise<Issue | null> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select()
      .from(tables.issues)
      .where(eq(tables.issues.issueNumber, issueNumber))
      .limit(1);

    if (result.length === 0) return null;

    return getIssue(result[0].id);
  });
}
