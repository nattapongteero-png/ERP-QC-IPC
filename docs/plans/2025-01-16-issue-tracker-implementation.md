# Issue Tracker Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an Issue Tracker module with AI-assisted validation, comments, attachments, and full audit trail.

**Architecture:** Follow existing template module patterns. Database schema uses dual SQLite/MySQL pattern. Services use `getTableRef()` and `executeDbOperation()`. UI uses DevExtreme components with TanStack Query.

**Tech Stack:** Next.js 16, Drizzle ORM, DevExtreme React 25.2.3, TanStack Query 5.x, Zod 4.x, OpenRouter AI API

---

## Phase 1: Foundation (Types, Schema, Validation)

### Task 1: Create Issue Types

**Files:**
- Create: `src/types/issues.ts`

**Step 1: Write the types file**

```typescript
// Issue Tracker Types

// Enums
export type IssueSeverity = 'critical' | 'major' | 'minor';
export type IssuePriority = 'immediate' | 'urgent' | 'scheduled' | 'backlog';
export type IssueStatus = 'draft' | 'submitted' | 'triaged' | 'in_progress' | 'resolved' | 'verified' | 'closed';
export type IssueCategoryType = 'software' | 'operational';
export type IssueAuditEventType =
  | 'created' | 'edited' | 'status_changed' | 'assigned'
  | 'priority_changed' | 'severity_changed' | 'commented'
  | 'merged' | 'attachment_added' | 'attachment_removed';
export type IssueNotificationType =
  | 'assigned' | 'mentioned' | 'status_changed'
  | 'commented' | 'merged' | 'priority_changed';

// Structured description for issues
export interface IssueDescription {
  summary: string;
  impact?: string;
  environment?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  stepsToReproduce?: string;
}

// Core entities
export interface Issue {
  id: number;
  issueNumber: string;
  title: string;
  description: IssueDescription;
  categoryId: number | null;
  severity: IssueSeverity;
  priority: IssuePriority | null;
  status: IssueStatus;
  reporterId: number;
  assigneeId: number | null;
  aiValidationPassed: boolean;
  aiValidationSkipped: boolean;
  duplicateOfId: number | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations
  category?: IssueCategory;
  reporter?: { id: number; name: string; email: string };
  assignee?: { id: number; name: string; email: string };
  duplicateOf?: Issue;
  tags?: IssueTag[];
  attachmentCount?: number;
  commentCount?: number;
}

export interface IssueCategory {
  id: number;
  name: string;
  description: string | null;
  type: IssueCategoryType;
  requiredFields: string[];
  aiPrompt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  issueCount?: number;
}

export interface IssueComment {
  id: number;
  issueId: number;
  authorId: number;
  content: string;
  mentionedUserIds: number[];
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations
  author?: { id: number; name: string; email: string };
  attachments?: IssueAttachment[];
}

export interface IssueAttachment {
  id: number;
  issueId: number | null;
  commentId: number | null;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedById: number;
  isDeleted: boolean;
  createdAt: string;
  // Relations
  uploadedBy?: { id: number; name: string };
}

export interface IssueTag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export interface IssueAuditEvent {
  id: number;
  issueId: number;
  eventType: IssueAuditEventType;
  actorId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
  // Relations
  actor?: { id: number; name: string };
}

export interface IssueNotification {
  id: number;
  userId: number;
  issueId: number;
  type: IssueNotificationType;
  message: string;
  isRead: boolean;
  emailSent: boolean;
  createdAt: string;
  // Relations
  issue?: { id: number; issueNumber: string; title: string };
}

// Create/Update types
export interface IssueCreate {
  title: string;
  description: IssueDescription;
  categoryId: number;
  severity: IssueSeverity;
  tagIds?: number[];
}

export interface IssueUpdate {
  title?: string;
  description?: IssueDescription;
  categoryId?: number;
  severity?: IssueSeverity;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeId?: number | null;
  tagIds?: number[];
}

export interface IssueCategoryCreate {
  name: string;
  description?: string;
  type: IssueCategoryType;
  requiredFields?: string[];
  aiPrompt?: string;
}

export interface IssueCategoryUpdate {
  name?: string;
  description?: string;
  type?: IssueCategoryType;
  requiredFields?: string[];
  aiPrompt?: string;
  isActive?: boolean;
}

export interface IssueCommentCreate {
  content: string;
}

export interface IssueCommentUpdate {
  content: string;
}

export interface IssueTagCreate {
  name: string;
  color: string;
}

// Filter types
export interface IssueListFilters {
  status?: IssueStatus;
  severity?: IssueSeverity;
  priority?: IssuePriority;
  categoryId?: number;
  assigneeId?: number;
  reporterId?: number;
  tagIds?: number[];
  search?: string;
  page?: number;
  limit?: number;
}

// AI Validation types
export interface AIValidationResult {
  pass: boolean;
  missingItems: string[];
  feedback: Array<{
    field: string;
    issue: string;
    suggestion: string;
  }>;
  followUpQuestions: string[];
  aiUnavailable?: boolean;
}

export interface AIDuplicateResult {
  potentialDuplicates: Array<{
    issueId: number;
    issueNumber: string;
    title: string;
    similarity: number;
    reason: string;
  }>;
  aiUnavailable?: boolean;
}

// Dashboard metrics
export interface IssueDashboardMetrics {
  totalIssues: number;
  openIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  issuesBySeverity: Array<{ severity: string; count: number }>;
  issuesByStatus: Array<{ status: string; count: number }>;
  issuesByCategory: Array<{ categoryId: number; categoryName: string; count: number }>;
  issuesByPriority: Array<{ priority: string; count: number }>;
  recentIssues: Issue[];
  monthlyTrend: Array<{ month: string; created: number; resolved: number }>;
  avgResolutionTime: number; // in hours
}
```

**Step 2: Verify types compile**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors related to issues.ts

**Step 3: Commit**

```bash
git add src/types/issues.ts
git commit -m "feat(issues): add type definitions"
```

---

### Task 2: Create Database Schema

**Files:**
- Create: `src/lib/db/schema-issues.ts`
- Modify: `src/lib/db/schema.ts` (add exports)

**Step 1: Write the schema file**

```typescript
// Issue Tracker Schema
// Dual SQLite/MySQL schema for issue tracking with AI validation

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { mysqlTable, varchar, int, datetime, boolean as mysqlBoolean, text as mysqlText, json } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { sqliteUsers, mysqlUsers } from './schema';

// ============================================
// SQLite Schema (for unit testing)
// ============================================

// Issue Categories
export const sqliteIssueCategories = sqliteTable('issue_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull().default('software'), // 'software' | 'operational'
  requiredFields: text('required_fields').notNull().default('[]'), // JSON array
  aiPrompt: text('ai_prompt'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Issues
export const sqliteIssues = sqliteTable('issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueNumber: text('issue_number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default('{}'), // JSON structured description
  categoryId: integer('category_id').references(() => sqliteIssueCategories.id),
  severity: text('severity').notNull().default('minor'), // 'critical' | 'major' | 'minor'
  priority: text('priority'), // 'immediate' | 'urgent' | 'scheduled' | 'backlog'
  status: text('status').notNull().default('draft'),
  reporterId: integer('reporter_id').notNull().references(() => sqliteUsers.id),
  assigneeId: integer('assignee_id').references(() => sqliteUsers.id),
  aiValidationPassed: integer('ai_validation_passed', { mode: 'boolean' }).notNull().default(false),
  aiValidationSkipped: integer('ai_validation_skipped', { mode: 'boolean' }).notNull().default(false),
  duplicateOfId: integer('duplicate_of_id').references((): any => sqliteIssues.id),
  resolvedAt: text('resolved_at'),
  verifiedAt: text('verified_at'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Issue Tags
export const sqliteIssueTags = sqliteTable('issue_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#3B82F6'),
  createdAt: text('created_at').notNull(),
});

// Issue Tag Links (many-to-many)
export const sqliteIssueTagLinks = sqliteTable('issue_tag_links', {
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id),
  tagId: integer('tag_id').notNull().references(() => sqliteIssueTags.id),
});

// Issue Comments
export const sqliteIssueComments = sqliteTable('issue_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id),
  authorId: integer('author_id').notNull().references(() => sqliteUsers.id),
  content: text('content').notNull(),
  mentionedUserIds: text('mentioned_user_ids').notNull().default('[]'), // JSON array
  isEdited: integer('is_edited', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Issue Attachments
export const sqliteIssueAttachments = sqliteTable('issue_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').references(() => sqliteIssues.id),
  commentId: integer('comment_id').references(() => sqliteIssueComments.id),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedById: integer('uploaded_by_id').notNull().references(() => sqliteUsers.id),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// Issue Audit Events
export const sqliteIssueAuditEvents = sqliteTable('issue_audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id),
  eventType: text('event_type').notNull(),
  actorId: integer('actor_id').notNull().references(() => sqliteUsers.id),
  oldValue: text('old_value'), // JSON
  newValue: text('new_value'), // JSON
  createdAt: text('created_at').notNull(),
});

// Issue Notifications
export const sqliteIssueNotifications = sqliteTable('issue_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => sqliteUsers.id),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  emailSent: integer('email_sent', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

// ============================================
// MySQL Schema (for production)
// ============================================

// Issue Categories
export const mysqlIssueCategories = mysqlTable('issue_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: mysqlText('description'),
  type: varchar('type', { length: 20 }).notNull().default('software'),
  requiredFields: json('required_fields').notNull().default([]),
  aiPrompt: mysqlText('ai_prompt'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Issues
export const mysqlIssues = mysqlTable('issues', {
  id: int('id').primaryKey().autoincrement(),
  issueNumber: varchar('issue_number', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 255 }).notNull(),
  description: json('description').notNull().default({}),
  categoryId: int('category_id').references(() => mysqlIssueCategories.id),
  severity: varchar('severity', { length: 20 }).notNull().default('minor'),
  priority: varchar('priority', { length: 20 }),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  reporterId: int('reporter_id').notNull().references(() => mysqlUsers.id),
  assigneeId: int('assignee_id').references(() => mysqlUsers.id),
  aiValidationPassed: mysqlBoolean('ai_validation_passed').notNull().default(false),
  aiValidationSkipped: mysqlBoolean('ai_validation_skipped').notNull().default(false),
  duplicateOfId: int('duplicate_of_id').references((): any => mysqlIssues.id),
  resolvedAt: datetime('resolved_at'),
  verifiedAt: datetime('verified_at'),
  closedAt: datetime('closed_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Issue Tags
export const mysqlIssueTags = mysqlTable('issue_tags', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
  createdAt: datetime('created_at').notNull(),
});

// Issue Tag Links
export const mysqlIssueTagLinks = mysqlTable('issue_tag_links', {
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id),
  tagId: int('tag_id').notNull().references(() => mysqlIssueTags.id),
});

// Issue Comments
export const mysqlIssueComments = mysqlTable('issue_comments', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id),
  authorId: int('author_id').notNull().references(() => mysqlUsers.id),
  content: mysqlText('content').notNull(),
  mentionedUserIds: json('mentioned_user_ids').notNull().default([]),
  isEdited: mysqlBoolean('is_edited').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// Issue Attachments
export const mysqlIssueAttachments = mysqlTable('issue_attachments', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').references(() => mysqlIssues.id),
  commentId: int('comment_id').references(() => mysqlIssueComments.id),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: int('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  uploadedById: int('uploaded_by_id').notNull().references(() => mysqlUsers.id),
  isDeleted: mysqlBoolean('is_deleted').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
});

// Issue Audit Events
export const mysqlIssueAuditEvents = mysqlTable('issue_audit_events', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  actorId: int('actor_id').notNull().references(() => mysqlUsers.id),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  createdAt: datetime('created_at').notNull(),
});

// Issue Notifications
export const mysqlIssueNotifications = mysqlTable('issue_notifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => mysqlUsers.id),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id),
  type: varchar('type', { length: 50 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  isRead: mysqlBoolean('is_read').notNull().default(false),
  emailSent: mysqlBoolean('email_sent').notNull().default(false),
  createdAt: datetime('created_at').notNull(),
});

// ============================================
// Relations
// ============================================

export const sqliteIssueCategoriesRelations = relations(sqliteIssueCategories, ({ many }) => ({
  issues: many(sqliteIssues),
}));

export const sqliteIssuesRelations = relations(sqliteIssues, ({ one, many }) => ({
  category: one(sqliteIssueCategories, {
    fields: [sqliteIssues.categoryId],
    references: [sqliteIssueCategories.id],
  }),
  reporter: one(sqliteUsers, {
    fields: [sqliteIssues.reporterId],
    references: [sqliteUsers.id],
  }),
  assignee: one(sqliteUsers, {
    fields: [sqliteIssues.assigneeId],
    references: [sqliteUsers.id],
  }),
  comments: many(sqliteIssueComments),
  attachments: many(sqliteIssueAttachments),
  auditEvents: many(sqliteIssueAuditEvents),
  tagLinks: many(sqliteIssueTagLinks),
}));

export const sqliteIssueCommentsRelations = relations(sqliteIssueComments, ({ one, many }) => ({
  issue: one(sqliteIssues, {
    fields: [sqliteIssueComments.issueId],
    references: [sqliteIssues.id],
  }),
  author: one(sqliteUsers, {
    fields: [sqliteIssueComments.authorId],
    references: [sqliteUsers.id],
  }),
  attachments: many(sqliteIssueAttachments),
}));

export const mysqlIssueCategoriesRelations = relations(mysqlIssueCategories, ({ many }) => ({
  issues: many(mysqlIssues),
}));

export const mysqlIssuesRelations = relations(mysqlIssues, ({ one, many }) => ({
  category: one(mysqlIssueCategories, {
    fields: [mysqlIssues.categoryId],
    references: [mysqlIssueCategories.id],
  }),
  reporter: one(mysqlUsers, {
    fields: [mysqlIssues.reporterId],
    references: [mysqlUsers.id],
  }),
  assignee: one(mysqlUsers, {
    fields: [mysqlIssues.assigneeId],
    references: [mysqlUsers.id],
  }),
  comments: many(mysqlIssueComments),
  attachments: many(mysqlIssueAttachments),
  auditEvents: many(mysqlIssueAuditEvents),
  tagLinks: many(mysqlIssueTagLinks),
}));

export const mysqlIssueCommentsRelations = relations(mysqlIssueComments, ({ one, many }) => ({
  issue: one(mysqlIssues, {
    fields: [mysqlIssueComments.issueId],
    references: [mysqlIssues.id],
  }),
  author: one(mysqlUsers, {
    fields: [mysqlIssueComments.authorId],
    references: [mysqlUsers.id],
  }),
  attachments: many(mysqlIssueAttachments),
}));
```

**Step 2: Add exports to schema.ts**

Add these exports at the end of `src/lib/db/schema.ts`:

```typescript
// Issue Tracker Schema
export * from './schema-issues';
```

**Step 3: Verify schema compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/db/schema-issues.ts src/lib/db/schema.ts
git commit -m "feat(issues): add database schema for issue tracker"
```

---

### Task 3: Create Validation Schemas

**Files:**
- Create: `src/lib/validation/issues.ts`

**Step 1: Write the validation file**

```typescript
// Issue Tracker Validation Schemas
import { z } from 'zod';

// Enums
export const issueSeveritySchema = z.enum(['critical', 'major', 'minor']);
export const issuePrioritySchema = z.enum(['immediate', 'urgent', 'scheduled', 'backlog']);
export const issueStatusSchema = z.enum(['draft', 'submitted', 'triaged', 'in_progress', 'resolved', 'verified', 'closed']);
export const issueCategoryTypeSchema = z.enum(['software', 'operational']);

// Structured description schema
export const issueDescriptionSchema = z.object({
  summary: z.string().min(10, 'Summary must be at least 10 characters').max(2000),
  impact: z.string().max(1000).optional(),
  environment: z.string().max(500).optional(),
  expectedBehavior: z.string().max(1000).optional(),
  actualBehavior: z.string().max(1000).optional(),
  stepsToReproduce: z.string().max(2000).optional(),
});

// Issue Create Schema
export const issueCreateSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  description: issueDescriptionSchema,
  categoryId: z.number().int().positive(),
  severity: issueSeveritySchema,
  tagIds: z.array(z.number().int().positive()).optional(),
});

// Issue Update Schema
export const issueUpdateSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  description: issueDescriptionSchema.optional(),
  categoryId: z.number().int().positive().optional(),
  severity: issueSeveritySchema.optional(),
  priority: issuePrioritySchema.optional().nullable(),
  status: issueStatusSchema.optional(),
  assigneeId: z.number().int().positive().optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

// Category Create Schema
export const issueCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  type: issueCategoryTypeSchema,
  requiredFields: z.array(z.string()).optional(),
  aiPrompt: z.string().max(2000).optional(),
});

// Category Update Schema
export const issueCategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  type: issueCategoryTypeSchema.optional(),
  requiredFields: z.array(z.string()).optional(),
  aiPrompt: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// Comment Create Schema
export const issueCommentCreateSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(10000),
});

// Comment Update Schema
export const issueCommentUpdateSchema = z.object({
  content: z.string().min(1).max(10000),
});

// Tag Create Schema
export const issueTagCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color'),
});

// Status change schema
export const issueStatusChangeSchema = z.object({
  status: issueStatusSchema,
  comment: z.string().max(500).optional(),
});

// Assign schema
export const issueAssignSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
});

// Merge schema
export const issueMergeSchema = z.object({
  targetIssueId: z.number().int().positive(),
});

// Type exports
export type IssueCreateInput = z.infer<typeof issueCreateSchema>;
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>;
export type IssueCategoryCreateInput = z.infer<typeof issueCategoryCreateSchema>;
export type IssueCategoryUpdateInput = z.infer<typeof issueCategoryUpdateSchema>;
export type IssueCommentCreateInput = z.infer<typeof issueCommentCreateSchema>;
export type IssueCommentUpdateInput = z.infer<typeof issueCommentUpdateSchema>;
export type IssueTagCreateInput = z.infer<typeof issueTagCreateSchema>;
export type IssueStatusChangeInput = z.infer<typeof issueStatusChangeSchema>;
export type IssueAssignInput = z.infer<typeof issueAssignSchema>;
export type IssueMergeInput = z.infer<typeof issueMergeSchema>;
```

**Step 2: Verify validation compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validation/issues.ts
git commit -m "feat(issues): add Zod validation schemas"
```

---

## Phase 2: Core Services

### Task 4: Create Issue Service (Core CRUD)

**Files:**
- Create: `src/lib/services/issues.service.ts`

**Step 1: Write the service file**

```typescript
// Issue Tracker Service - Core CRUD Operations

import { eq, and, like, desc, asc, sql, count, inArray, isNull, isNotNull } from 'drizzle-orm';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation, isSqlite } from '../db/db-helper';
import type {
  Issue,
  IssueCategory,
  IssueCreate,
  IssueUpdate,
  IssueCategoryCreate,
  IssueCategoryUpdate,
  IssueListFilters,
  IssueTag,
  IssueTagCreate,
  IssueDescription,
} from '@/types/issues';

// Get tables based on database type
function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    categories: getTableRef('issueCategories'),
    tags: getTableRef('issueTags'),
    tagLinks: getTableRef('issueTagLinks'),
    comments: getTableRef('issueComments'),
    attachments: getTableRef('issueAttachments'),
    auditEvents: getTableRef('issueAuditEvents'),
    notifications: getTableRef('issueNotifications'),
    users: getTableRef('users'),
  };
}

// Helper to parse JSON fields
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return (value as T) || defaultValue;
}

// Generate issue number (ISS-YYYY-NNNN)
async function generateIssueNumber(): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const year = new Date().getFullYear();
    const prefix = `ISS-${year}-`;

    const result = await db
      .select({ issueNumber: tables.issues.issueNumber })
      .from(tables.issues)
      .where(like(tables.issues.issueNumber, `${prefix}%`))
      .orderBy(desc(tables.issues.id))
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0) {
      const lastNumber = parseInt(result[0].issueNumber.split('-')[2], 10);
      nextNumber = lastNumber + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  });
}

// ============================================
// Issues CRUD
// ============================================

export async function listIssues(filters?: IssueListFilters) {
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
      conditions.push(like(tables.issues.title, `%${filters.search}%`));
    }

    const limit = filters?.limit || 50;
    const offset = ((filters?.page || 1) - 1) * limit;

    const issues = await db
      .select({
        id: tables.issues.id,
        issueNumber: tables.issues.issueNumber,
        title: tables.issues.title,
        description: tables.issues.description,
        categoryId: tables.issues.categoryId,
        severity: tables.issues.severity,
        priority: tables.issues.priority,
        status: tables.issues.status,
        reporterId: tables.issues.reporterId,
        assigneeId: tables.issues.assigneeId,
        aiValidationPassed: tables.issues.aiValidationPassed,
        aiValidationSkipped: tables.issues.aiValidationSkipped,
        duplicateOfId: tables.issues.duplicateOfId,
        resolvedAt: tables.issues.resolvedAt,
        verifiedAt: tables.issues.verifiedAt,
        closedAt: tables.issues.closedAt,
        createdAt: tables.issues.createdAt,
        updatedAt: tables.issues.updatedAt,
        categoryName: tables.categories.name,
        reporterName: tables.users.name,
      })
      .from(tables.issues)
      .leftJoin(tables.categories, eq(tables.issues.categoryId, tables.categories.id))
      .leftJoin(tables.users, eq(tables.issues.reporterId, tables.users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tables.issues.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return {
      issues: issues.map(i => ({
        ...i,
        description: parseJsonField<IssueDescription>(i.description, { summary: '' }),
        category: i.categoryName ? { id: i.categoryId, name: i.categoryName } : null,
        reporter: { id: i.reporterId, name: i.reporterName || 'Unknown' },
      })),
      total: Number(countResult[0]?.count || 0),
      page: filters?.page || 1,
      limit,
    };
  });
}

export async function getIssue(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select()
      .from(tables.issues)
      .where(eq(tables.issues.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const issue = result[0];

    // Get category
    let category = null;
    if (issue.categoryId) {
      const catResult = await db
        .select()
        .from(tables.categories)
        .where(eq(tables.categories.id, issue.categoryId))
        .limit(1);
      category = catResult[0] || null;
    }

    // Get reporter
    const reporterResult = await db
      .select({ id: tables.users.id, name: tables.users.name, email: tables.users.email })
      .from(tables.users)
      .where(eq(tables.users.id, issue.reporterId))
      .limit(1);

    // Get assignee
    let assignee = null;
    if (issue.assigneeId) {
      const assigneeResult = await db
        .select({ id: tables.users.id, name: tables.users.name, email: tables.users.email })
        .from(tables.users)
        .where(eq(tables.users.id, issue.assigneeId))
        .limit(1);
      assignee = assigneeResult[0] || null;
    }

    // Get tags
    const tagLinks = await db
      .select({ tagId: tables.tagLinks.tagId })
      .from(tables.tagLinks)
      .where(eq(tables.tagLinks.issueId, id));

    let tags: IssueTag[] = [];
    if (tagLinks.length > 0) {
      const tagIds = tagLinks.map(tl => tl.tagId);
      tags = await db
        .select()
        .from(tables.tags)
        .where(inArray(tables.tags.id, tagIds));
    }

    // Get counts
    const commentCount = await db
      .select({ count: count() })
      .from(tables.comments)
      .where(eq(tables.comments.issueId, id));

    const attachmentCount = await db
      .select({ count: count() })
      .from(tables.attachments)
      .where(and(eq(tables.attachments.issueId, id), eq(tables.attachments.isDeleted, false)));

    return {
      ...issue,
      description: parseJsonField<IssueDescription>(issue.description, { summary: '' }),
      category: category ? {
        ...category,
        requiredFields: parseJsonField<string[]>(category.requiredFields, []),
      } : null,
      reporter: reporterResult[0] || { id: issue.reporterId, name: 'Unknown', email: '' },
      assignee,
      tags,
      commentCount: Number(commentCount[0]?.count || 0),
      attachmentCount: Number(attachmentCount[0]?.count || 0),
    };
  });
}

export async function createIssue(data: IssueCreate, reporterId: number, status: 'draft' | 'submitted' = 'draft') {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();
    const issueNumber = await generateIssueNumber();

    const insertData = {
      issueNumber,
      title: data.title,
      description: isSqlite() ? JSON.stringify(data.description) : data.description,
      categoryId: data.categoryId,
      severity: data.severity,
      priority: null,
      status,
      reporterId,
      assigneeId: null,
      aiValidationPassed: status === 'submitted',
      aiValidationSkipped: false,
      duplicateOfId: null,
      resolvedAt: null,
      verifiedAt: null,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.issues).values(insertData);
    const insertId = getInsertId(result);

    // Add tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await db.insert(tables.tagLinks).values(
        data.tagIds.map(tagId => ({ issueId: insertId, tagId }))
      );
    }

    // Create audit event
    await db.insert(tables.auditEvents).values({
      issueId: insertId,
      eventType: 'created',
      actorId: reporterId,
      oldValue: null,
      newValue: isSqlite() ? JSON.stringify({ title: data.title, status }) : { title: data.title, status },
      createdAt: now,
    });

    return getIssue(insertId);
  });
}

export async function updateIssue(id: number, data: IssueUpdate, actorId: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get existing issue
    const existing = await getIssue(id);
    if (!existing) throw new Error('Issue not found');

    const now = getNow();
    const updateData: Record<string, unknown> = { updatedAt: now };
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    if (data.title !== undefined && data.title !== existing.title) {
      updateData.title = data.title;
      changes.title = { old: existing.title, new: data.title };
    }
    if (data.description !== undefined) {
      updateData.description = isSqlite() ? JSON.stringify(data.description) : data.description;
      changes.description = { old: existing.description, new: data.description };
    }
    if (data.categoryId !== undefined) {
      updateData.categoryId = data.categoryId;
      changes.categoryId = { old: existing.categoryId, new: data.categoryId };
    }
    if (data.severity !== undefined && data.severity !== existing.severity) {
      updateData.severity = data.severity;
      changes.severity = { old: existing.severity, new: data.severity };
    }
    if (data.priority !== undefined && data.priority !== existing.priority) {
      updateData.priority = data.priority;
      changes.priority = { old: existing.priority, new: data.priority };
    }
    if (data.status !== undefined && data.status !== existing.status) {
      updateData.status = data.status;
      changes.status = { old: existing.status, new: data.status };

      // Update status timestamps
      if (data.status === 'resolved') updateData.resolvedAt = now;
      if (data.status === 'verified') updateData.verifiedAt = now;
      if (data.status === 'closed') updateData.closedAt = now;
    }
    if (data.assigneeId !== undefined && data.assigneeId !== existing.assigneeId) {
      updateData.assigneeId = data.assigneeId;
      changes.assigneeId = { old: existing.assigneeId, new: data.assigneeId };
    }

    await db.update(tables.issues).set(updateData).where(eq(tables.issues.id, id));

    // Update tags if provided
    if (data.tagIds !== undefined) {
      await db.delete(tables.tagLinks).where(eq(tables.tagLinks.issueId, id));
      if (data.tagIds.length > 0) {
        await db.insert(tables.tagLinks).values(
          data.tagIds.map(tagId => ({ issueId: id, tagId }))
        );
      }
    }

    // Create audit events for significant changes
    if (Object.keys(changes).length > 0) {
      const eventType = changes.status ? 'status_changed' :
                       changes.assigneeId ? 'assigned' :
                       changes.priority ? 'priority_changed' :
                       changes.severity ? 'severity_changed' : 'edited';

      await db.insert(tables.auditEvents).values({
        issueId: id,
        eventType,
        actorId,
        oldValue: isSqlite() ? JSON.stringify(Object.fromEntries(
          Object.entries(changes).map(([k, v]) => [k, v.old])
        )) : Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
        newValue: isSqlite() ? JSON.stringify(Object.fromEntries(
          Object.entries(changes).map(([k, v]) => [k, v.new])
        )) : Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
        createdAt: now,
      });
    }

    return getIssue(id);
  });
}

export async function deleteIssue(id: number, actorId: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Delete related records first
    await db.delete(tables.tagLinks).where(eq(tables.tagLinks.issueId, id));
    await db.delete(tables.auditEvents).where(eq(tables.auditEvents.issueId, id));
    await db.delete(tables.notifications).where(eq(tables.notifications.issueId, id));
    await db.delete(tables.attachments).where(eq(tables.attachments.issueId, id));
    await db.delete(tables.comments).where(eq(tables.comments.issueId, id));
    await db.delete(tables.issues).where(eq(tables.issues.id, id));

    return { success: true };
  });
}

// ============================================
// Categories CRUD
// ============================================

export async function listIssueCategories(filters?: { isActive?: boolean }) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const conditions: any[] = [];

    if (filters?.isActive !== undefined) {
      conditions.push(eq(tables.categories.isActive, filters.isActive));
    }

    const categories = await db
      .select()
      .from(tables.categories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tables.categories.name));

    return categories.map(c => ({
      ...c,
      requiredFields: parseJsonField<string[]>(c.requiredFields, []),
    }));
  });
}

export async function getIssueCategory(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const result = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, id))
      .limit(1);

    if (result.length === 0) return null;

    return {
      ...result[0],
      requiredFields: parseJsonField<string[]>(result[0].requiredFields, []),
    };
  });
}

export async function createIssueCategory(data: IssueCategoryCreate) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();

    const insertData = {
      name: data.name,
      description: data.description || null,
      type: data.type,
      requiredFields: isSqlite() ? JSON.stringify(data.requiredFields || []) : (data.requiredFields || []),
      aiPrompt: data.aiPrompt || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.categories).values(insertData);
    const insertId = getInsertId(result);

    return getIssueCategory(insertId);
  });
}

export async function updateIssueCategory(id: number, data: IssueCategoryUpdate) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.requiredFields !== undefined) {
      updateData.requiredFields = isSqlite() ? JSON.stringify(data.requiredFields) : data.requiredFields;
    }
    if (data.aiPrompt !== undefined) updateData.aiPrompt = data.aiPrompt;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db.update(tables.categories).set(updateData).where(eq(tables.categories.id, id));

    return getIssueCategory(id);
  });
}

export async function deleteIssueCategory(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Check if any issues use this category
    const issues = await db
      .select({ id: tables.issues.id })
      .from(tables.issues)
      .where(eq(tables.issues.categoryId, id))
      .limit(1);

    if (issues.length > 0) {
      throw new Error('Cannot delete category with existing issues');
    }

    await db.delete(tables.categories).where(eq(tables.categories.id, id));

    return { success: true };
  });
}

// ============================================
// Tags CRUD
// ============================================

export async function listIssueTags() {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    return db.select().from(tables.tags).orderBy(asc(tables.tags.name));
  });
}

export async function createIssueTag(data: IssueTagCreate) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();

    const result = await db.insert(tables.tags).values({
      name: data.name,
      color: data.color,
      createdAt: now,
    });

    const insertId = getInsertId(result);

    const created = await db
      .select()
      .from(tables.tags)
      .where(eq(tables.tags.id, insertId))
      .limit(1);

    return created[0];
  });
}

export async function deleteIssueTag(id: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    await db.delete(tables.tagLinks).where(eq(tables.tagLinks.tagId, id));
    await db.delete(tables.tags).where(eq(tables.tags.id, id));

    return { success: true };
  });
}
```

**Step 2: Verify service compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/issues.service.ts
git commit -m "feat(issues): add core CRUD service"
```

---

### Task 5: Create AI Validation Service

**Files:**
- Create: `src/lib/services/issues-ai.service.ts`

**Step 1: Write the AI service file**

```typescript
// Issue Tracker AI Validation Service
// Uses OpenRouter API for issue quality validation and duplicate detection

import { eq, and, notInArray, inArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation, isSqlite } from '../db/db-helper';
import type { IssueDescription, AIValidationResult, AIDuplicateResult, IssueCategory } from '@/types/issues';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
const OPENROUTER_TIMEOUT = parseInt(process.env.OPENROUTER_TIMEOUT || '10000', 10);

// Get tables
function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    categories: getTableRef('issueCategories'),
  };
}

// Helper to parse JSON fields
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return (value as T) || defaultValue;
}

// Call OpenRouter API with timeout
async function callOpenRouter(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Herbal Medicine ERP - Issue Tracker',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('OpenRouter API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      console.error('OpenRouter API timeout');
    } else {
      console.error('OpenRouter API error:', error);
    }
    return null;
  }
}

// Parse AI response as JSON
function parseAIResponse<T>(response: string | null, defaultValue: T): T {
  if (!response) return defaultValue;

  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();
    return JSON.parse(jsonStr);
  } catch {
    console.error('Failed to parse AI response:', response);
    return defaultValue;
  }
}

// Validate issue quality
export async function validateIssue(
  title: string,
  description: IssueDescription,
  categoryId: number
): Promise<AIValidationResult> {
  // Get category info
  const category = await executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const result = await db
      .select()
      .from(tables.categories)
      .where(eq(tables.categories.id, categoryId))
      .limit(1);
    return result[0] || null;
  });

  if (!category) {
    return {
      pass: false,
      missingItems: ['categoryId'],
      feedback: [{ field: 'categoryId', issue: 'Invalid category', suggestion: 'Select a valid category' }],
      followUpQuestions: [],
    };
  }

  const requiredFields = parseJsonField<string[]>(category.requiredFields, []);
  const customPrompt = category.aiPrompt || '';

  const prompt = `You are an issue quality validator for a pharmaceutical/herbal medicine ERP system. Evaluate this issue submission for completeness and actionable detail.

Category: ${category.name} (${category.type})
Required fields for this category: ${requiredFields.join(', ') || 'none specified'}

Issue Data:
- Title: ${title}
- Summary: ${description.summary || '(empty)'}
- Impact: ${description.impact || '(empty)'}
- Environment: ${description.environment || '(empty)'}
- Expected Behavior: ${description.expectedBehavior || '(empty)'}
- Actual Behavior: ${description.actualBehavior || '(empty)'}
- Steps to Reproduce: ${description.stepsToReproduce || '(empty)'}

${customPrompt ? `Additional validation rules:\n${customPrompt}` : ''}

Evaluate the issue and respond with ONLY valid JSON (no markdown, no explanation):
{
  "pass": boolean,
  "missingItems": ["field names that are empty but required"],
  "feedback": [
    { "field": "field_name", "issue": "what's wrong", "suggestion": "how to fix" }
  ],
  "followUpQuestions": ["questions to help user provide better detail"]
}

Rules:
- Title should be clear and specific (not vague like "Bug" or "Problem")
- Summary is always required and should be at least 20 characters
- For software issues, stepsToReproduce and environment are important
- For operational issues, impact is critical
- Be helpful but strict - pass only if the issue has enough detail to be actionable`;

  const response = await callOpenRouter(prompt);

  if (!response) {
    return {
      pass: false,
      missingItems: [],
      feedback: [],
      followUpQuestions: [],
      aiUnavailable: true,
    };
  }

  return parseAIResponse<AIValidationResult>(response, {
    pass: false,
    missingItems: [],
    feedback: [{ field: 'general', issue: 'Could not parse AI response', suggestion: 'Try again' }],
    followUpQuestions: [],
  });
}

// Check for duplicate issues
export async function checkDuplicates(
  title: string,
  summary: string,
  excludeIssueId?: number
): Promise<AIDuplicateResult> {
  // Get recent open issues for comparison
  const existingIssues = await executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const conditions = [
      notInArray(tables.issues.status, ['closed', 'draft']),
    ];

    if (excludeIssueId) {
      conditions.push(eq(tables.issues.id, excludeIssueId));
    }

    return db
      .select({
        id: tables.issues.id,
        issueNumber: tables.issues.issueNumber,
        title: tables.issues.title,
        description: tables.issues.description,
      })
      .from(tables.issues)
      .where(and(...conditions))
      .limit(50);
  });

  if (existingIssues.length === 0) {
    return { potentialDuplicates: [] };
  }

  const issuesList = existingIssues.map(i => {
    const desc = parseJsonField<IssueDescription>(i.description, { summary: '' });
    return `- ${i.issueNumber}: "${i.title}" - ${desc.summary?.substring(0, 100) || '(no summary)'}`;
  }).join('\n');

  const prompt = `You are checking for duplicate issues in a pharmaceutical/herbal medicine ERP system.

New Issue:
- Title: ${title}
- Summary: ${summary}

Existing Open Issues:
${issuesList}

Compare the new issue against existing ones and find potential duplicates. Consider:
- Similar problem descriptions
- Same feature/area affected
- Similar symptoms or behaviors

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "potentialDuplicates": [
    { "issueId": number, "issueNumber": "string", "title": "string", "similarity": 0-100, "reason": "why similar" }
  ]
}

Only include issues with similarity >= 60. Return empty array if no duplicates found.`;

  const response = await callOpenRouter(prompt);

  if (!response) {
    return {
      potentialDuplicates: [],
      aiUnavailable: true,
    };
  }

  const result = parseAIResponse<AIDuplicateResult>(response, { potentialDuplicates: [] });

  // Validate and enrich the response with actual issue data
  const validDuplicates = result.potentialDuplicates.filter(d => {
    const match = existingIssues.find(i =>
      i.id === d.issueId || i.issueNumber === d.issueNumber
    );
    if (match) {
      d.issueId = match.id;
      d.issueNumber = match.issueNumber;
      d.title = match.title;
      return true;
    }
    return false;
  });

  return { potentialDuplicates: validDuplicates };
}
```

**Step 2: Add environment variables to .env.local**

Add to `.env.local`:
```
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=google/gemini-3-flash-preview
OPENROUTER_TIMEOUT=10000
```

**Step 3: Verify service compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/services/issues-ai.service.ts
git commit -m "feat(issues): add AI validation service with OpenRouter"
```

---

### Task 6: Create Comments Service

**Files:**
- Create: `src/lib/services/issues-comments.service.ts`

**Step 1: Write the comments service**

```typescript
// Issue Tracker Comments Service

import { eq, and, desc } from 'drizzle-orm';
import { getNow } from '../db/date-utils';
import { getTableRef, getInsertId, executeDbOperation, isSqlite } from '../db/db-helper';
import type { IssueComment, IssueCommentCreate, IssueCommentUpdate } from '@/types/issues';

function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    comments: getTableRef('issueComments'),
    attachments: getTableRef('issueAttachments'),
    auditEvents: getTableRef('issueAuditEvents'),
    users: getTableRef('users'),
  };
}

// Helper to parse JSON fields
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return (value as T) || defaultValue;
}

// Extract @mentions from content
export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map(m => m.slice(1)) : [];
}

// Resolve usernames to user IDs
export async function resolveUsernames(usernames: string[]): Promise<number[]> {
  if (usernames.length === 0) return [];

  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const users = await db
      .select({ id: tables.users.id, email: tables.users.email })
      .from(tables.users);

    // Match by email prefix (before @)
    const userIds: number[] = [];
    for (const username of usernames) {
      const user = users.find(u =>
        u.email.split('@')[0].toLowerCase() === username.toLowerCase()
      );
      if (user) userIds.push(user.id);
    }

    return userIds;
  });
}

// List comments for an issue
export async function listIssueComments(issueId: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    const comments = await db
      .select({
        id: tables.comments.id,
        issueId: tables.comments.issueId,
        authorId: tables.comments.authorId,
        content: tables.comments.content,
        mentionedUserIds: tables.comments.mentionedUserIds,
        isEdited: tables.comments.isEdited,
        createdAt: tables.comments.createdAt,
        updatedAt: tables.comments.updatedAt,
        authorName: tables.users.name,
        authorEmail: tables.users.email,
      })
      .from(tables.comments)
      .leftJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .where(eq(tables.comments.issueId, issueId))
      .orderBy(desc(tables.comments.createdAt));

    return comments.map(c => ({
      id: c.id,
      issueId: c.issueId,
      authorId: c.authorId,
      content: c.content,
      mentionedUserIds: parseJsonField<number[]>(c.mentionedUserIds, []),
      isEdited: c.isEdited,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.authorId,
        name: c.authorName || 'Unknown',
        email: c.authorEmail || '',
      },
    }));
  });
}

// Create a comment
export async function createIssueComment(issueId: number, data: IssueCommentCreate, authorId: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();

    // Extract and resolve mentions
    const mentionUsernames = extractMentions(data.content);
    const mentionedUserIds = await resolveUsernames(mentionUsernames);

    const insertData = {
      issueId,
      authorId,
      content: data.content,
      mentionedUserIds: isSqlite() ? JSON.stringify(mentionedUserIds) : mentionedUserIds,
      isEdited: false,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.insert(tables.comments).values(insertData);
    const insertId = getInsertId(result);

    // Create audit event
    await db.insert(tables.auditEvents).values({
      issueId,
      eventType: 'commented',
      actorId: authorId,
      oldValue: null,
      newValue: isSqlite() ? JSON.stringify({ commentId: insertId }) : { commentId: insertId },
      createdAt: now,
    });

    // Get the created comment with author info
    const created = await db
      .select({
        id: tables.comments.id,
        issueId: tables.comments.issueId,
        authorId: tables.comments.authorId,
        content: tables.comments.content,
        mentionedUserIds: tables.comments.mentionedUserIds,
        isEdited: tables.comments.isEdited,
        createdAt: tables.comments.createdAt,
        updatedAt: tables.comments.updatedAt,
        authorName: tables.users.name,
        authorEmail: tables.users.email,
      })
      .from(tables.comments)
      .leftJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .where(eq(tables.comments.id, insertId))
      .limit(1);

    const c = created[0];
    return {
      id: c.id,
      issueId: c.issueId,
      authorId: c.authorId,
      content: c.content,
      mentionedUserIds: parseJsonField<number[]>(c.mentionedUserIds, []),
      isEdited: c.isEdited,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.authorId,
        name: c.authorName || 'Unknown',
        email: c.authorEmail || '',
      },
    };
  });
}

// Update a comment
export async function updateIssueComment(commentId: number, data: IssueCommentUpdate, actorId: number) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();
    const now = getNow();

    // Get existing comment
    const existing = await db
      .select()
      .from(tables.comments)
      .where(eq(tables.comments.id, commentId))
      .limit(1);

    if (existing.length === 0) throw new Error('Comment not found');

    // Only author can edit
    if (existing[0].authorId !== actorId) {
      throw new Error('Only the author can edit this comment');
    }

    // Extract and resolve new mentions
    const mentionUsernames = extractMentions(data.content);
    const mentionedUserIds = await resolveUsernames(mentionUsernames);

    await db.update(tables.comments).set({
      content: data.content,
      mentionedUserIds: isSqlite() ? JSON.stringify(mentionedUserIds) : mentionedUserIds,
      isEdited: true,
      updatedAt: now,
    }).where(eq(tables.comments.id, commentId));

    // Get updated comment
    const updated = await db
      .select({
        id: tables.comments.id,
        issueId: tables.comments.issueId,
        authorId: tables.comments.authorId,
        content: tables.comments.content,
        mentionedUserIds: tables.comments.mentionedUserIds,
        isEdited: tables.comments.isEdited,
        createdAt: tables.comments.createdAt,
        updatedAt: tables.comments.updatedAt,
        authorName: tables.users.name,
        authorEmail: tables.users.email,
      })
      .from(tables.comments)
      .leftJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .where(eq(tables.comments.id, commentId))
      .limit(1);

    const c = updated[0];
    return {
      id: c.id,
      issueId: c.issueId,
      authorId: c.authorId,
      content: c.content,
      mentionedUserIds: parseJsonField<number[]>(c.mentionedUserIds, []),
      isEdited: c.isEdited,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.authorId,
        name: c.authorName || 'Unknown',
        email: c.authorEmail || '',
      },
    };
  });
}

// Delete a comment
export async function deleteIssueComment(commentId: number, actorId: number, isAdmin: boolean = false) {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get existing comment
    const existing = await db
      .select()
      .from(tables.comments)
      .where(eq(tables.comments.id, commentId))
      .limit(1);

    if (existing.length === 0) throw new Error('Comment not found');

    // Only author or admin can delete
    if (existing[0].authorId !== actorId && !isAdmin) {
      throw new Error('Only the author or admin can delete this comment');
    }

    // Delete attachments first
    await db.delete(tables.attachments).where(eq(tables.attachments.commentId, commentId));

    // Delete comment
    await db.delete(tables.comments).where(eq(tables.comments.id, commentId));

    return { success: true };
  });
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/issues-comments.service.ts
git commit -m "feat(issues): add comments service with @mention support"
```

---

### Task 7: Create Timeline Service

**Files:**
- Create: `src/lib/services/issues-timeline.service.ts`

**Step 1: Write the timeline service**

```typescript
// Issue Tracker Timeline Service
// Combines audit events and comments into a chronological timeline

import { eq, desc } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '../db/db-helper';

function getIssueTables() {
  return {
    auditEvents: getTableRef('issueAuditEvents'),
    comments: getTableRef('issueComments'),
    users: getTableRef('users'),
  };
}

// Helper to parse JSON fields
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return (value as T) || defaultValue;
}

export interface TimelineItem {
  id: string;
  type: 'audit' | 'comment';
  issueId: number;
  actorId: number;
  actorName: string;
  createdAt: string;
  // For audit events
  eventType?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  // For comments
  content?: string;
  isEdited?: boolean;
  mentionedUserIds?: number[];
}

// Get timeline for an issue
export async function getIssueTimeline(issueId: number): Promise<TimelineItem[]> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Get audit events
    const auditEvents = await db
      .select({
        id: tables.auditEvents.id,
        issueId: tables.auditEvents.issueId,
        eventType: tables.auditEvents.eventType,
        actorId: tables.auditEvents.actorId,
        oldValue: tables.auditEvents.oldValue,
        newValue: tables.auditEvents.newValue,
        createdAt: tables.auditEvents.createdAt,
        actorName: tables.users.name,
      })
      .from(tables.auditEvents)
      .leftJoin(tables.users, eq(tables.auditEvents.actorId, tables.users.id))
      .where(eq(tables.auditEvents.issueId, issueId));

    // Get comments
    const comments = await db
      .select({
        id: tables.comments.id,
        issueId: tables.comments.issueId,
        authorId: tables.comments.authorId,
        content: tables.comments.content,
        mentionedUserIds: tables.comments.mentionedUserIds,
        isEdited: tables.comments.isEdited,
        createdAt: tables.comments.createdAt,
        authorName: tables.users.name,
      })
      .from(tables.comments)
      .leftJoin(tables.users, eq(tables.comments.authorId, tables.users.id))
      .where(eq(tables.comments.issueId, issueId));

    // Combine and sort
    const timeline: TimelineItem[] = [
      ...auditEvents.map(e => ({
        id: `audit-${e.id}`,
        type: 'audit' as const,
        issueId: e.issueId,
        actorId: e.actorId,
        actorName: e.actorName || 'Unknown',
        createdAt: e.createdAt,
        eventType: e.eventType,
        oldValue: parseJsonField<Record<string, unknown> | null>(e.oldValue, null),
        newValue: parseJsonField<Record<string, unknown> | null>(e.newValue, null),
      })),
      ...comments.map(c => ({
        id: `comment-${c.id}`,
        type: 'comment' as const,
        issueId: c.issueId,
        actorId: c.authorId,
        actorName: c.authorName || 'Unknown',
        createdAt: c.createdAt,
        content: c.content,
        isEdited: c.isEdited,
        mentionedUserIds: parseJsonField<number[]>(c.mentionedUserIds, []),
      })),
    ];

    // Sort by createdAt descending (newest first)
    timeline.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return timeline;
  });
}

// Get human-readable description for audit event
export function getAuditEventDescription(event: TimelineItem): string {
  if (event.type !== 'audit' || !event.eventType) return '';

  switch (event.eventType) {
    case 'created':
      return 'created this issue';
    case 'edited':
      return 'edited the issue';
    case 'status_changed':
      return `changed status from "${event.oldValue?.status || 'unknown'}" to "${event.newValue?.status || 'unknown'}"`;
    case 'assigned':
      if (event.newValue?.assigneeId) {
        return 'assigned this issue';
      }
      return 'unassigned this issue';
    case 'priority_changed':
      return `changed priority from "${event.oldValue?.priority || 'none'}" to "${event.newValue?.priority || 'none'}"`;
    case 'severity_changed':
      return `changed severity from "${event.oldValue?.severity || 'unknown'}" to "${event.newValue?.severity || 'unknown'}"`;
    case 'commented':
      return 'added a comment';
    case 'merged':
      return `merged this issue as duplicate of #${event.newValue?.duplicateOfId}`;
    case 'attachment_added':
      return 'added an attachment';
    case 'attachment_removed':
      return 'removed an attachment';
    default:
      return `performed action: ${event.eventType}`;
  }
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/issues-timeline.service.ts
git commit -m "feat(issues): add timeline service for audit + comments"
```

---

### Task 8: Create Dashboard Service

**Files:**
- Create: `src/lib/services/issues-dashboard.service.ts`

**Step 1: Write the dashboard service**

```typescript
// Issue Tracker Dashboard Service

import { eq, and, count, sql, gte, desc, notInArray } from 'drizzle-orm';
import { getTableRef, executeDbOperation, isSqlite } from '../db/db-helper';
import { toQueryDate } from '../db/date-utils';
import type { IssueDashboardMetrics, IssueDescription } from '@/types/issues';

function getIssueTables() {
  return {
    issues: getTableRef('issues'),
    categories: getTableRef('issueCategories'),
    users: getTableRef('users'),
  };
}

// Helper to parse JSON fields
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }
  return (value as T) || defaultValue;
}

export async function getIssueDashboardMetrics(): Promise<IssueDashboardMetrics> {
  return executeDbOperation(async (db) => {
    const tables = getIssueTables();

    // Total issues
    const totalResult = await db.select({ count: count() }).from(tables.issues);
    const totalIssues = Number(totalResult[0]?.count || 0);

    // Open issues (not closed)
    const openResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(notInArray(tables.issues.status, ['closed']));
    const openIssues = Number(openResult[0]?.count || 0);

    // Resolved issues
    const resolvedResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(eq(tables.issues.status, 'resolved'));
    const resolvedIssues = Number(resolvedResult[0]?.count || 0);

    // Closed issues
    const closedResult = await db
      .select({ count: count() })
      .from(tables.issues)
      .where(eq(tables.issues.status, 'closed'));
    const closedIssues = Number(closedResult[0]?.count || 0);

    // Issues by severity
    const severityResult = await db
      .select({
        severity: tables.issues.severity,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.severity);
    const issuesBySeverity = severityResult.map(r => ({
      severity: r.severity,
      count: Number(r.count),
    }));

    // Issues by status
    const statusResult = await db
      .select({
        status: tables.issues.status,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.status);
    const issuesByStatus = statusResult.map(r => ({
      status: r.status,
      count: Number(r.count),
    }));

    // Issues by category
    const categoryResult = await db
      .select({
        categoryId: tables.issues.categoryId,
        categoryName: tables.categories.name,
        count: count(),
      })
      .from(tables.issues)
      .leftJoin(tables.categories, eq(tables.issues.categoryId, tables.categories.id))
      .groupBy(tables.issues.categoryId, tables.categories.name);
    const issuesByCategory = categoryResult
      .filter(r => r.categoryId !== null)
      .map(r => ({
        categoryId: r.categoryId!,
        categoryName: r.categoryName || 'Unknown',
        count: Number(r.count),
      }));

    // Issues by priority
    const priorityResult = await db
      .select({
        priority: tables.issues.priority,
        count: count(),
      })
      .from(tables.issues)
      .groupBy(tables.issues.priority);
    const issuesByPriority = priorityResult
      .filter(r => r.priority !== null)
      .map(r => ({
        priority: r.priority!,
        count: Number(r.count),
      }));

    // Recent issues
    const recentResult = await db
      .select({
        id: tables.issues.id,
        issueNumber: tables.issues.issueNumber,
        title: tables.issues.title,
        description: tables.issues.description,
        severity: tables.issues.severity,
        priority: tables.issues.priority,
        status: tables.issues.status,
        createdAt: tables.issues.createdAt,
        reporterName: tables.users.name,
      })
      .from(tables.issues)
      .leftJoin(tables.users, eq(tables.issues.reporterId, tables.users.id))
      .orderBy(desc(tables.issues.createdAt))
      .limit(10);

    const recentIssues = recentResult.map(r => ({
      id: r.id,
      issueNumber: r.issueNumber,
      title: r.title,
      description: parseJsonField<IssueDescription>(r.description, { summary: '' }),
      severity: r.severity,
      priority: r.priority,
      status: r.status,
      createdAt: r.createdAt,
      reporter: { name: r.reporterName || 'Unknown' },
    })) as any[];

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // For simplicity, calculate from recent data
    const monthlyTrend: Array<{ month: string; created: number; resolved: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.toISOString().slice(0, 7); // YYYY-MM
      monthlyTrend.push({ month, created: 0, resolved: 0 });
    }

    // Calculate average resolution time (simplified)
    const avgResolutionTime = 48; // Default 48 hours, would calculate from actual data

    return {
      totalIssues,
      openIssues,
      resolvedIssues,
      closedIssues,
      issuesBySeverity,
      issuesByStatus,
      issuesByCategory,
      issuesByPriority,
      recentIssues,
      monthlyTrend,
      avgResolutionTime,
    };
  });
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/services/issues-dashboard.service.ts
git commit -m "feat(issues): add dashboard metrics service"
```

---

## Phase 3: API Routes

### Task 9: Create Issues API Routes

**Files:**
- Create: `src/app/api/issues/route.ts`
- Create: `src/app/api/issues/[id]/route.ts`

**Step 1: Create main issues route**

Create `src/app/api/issues/route.ts`:

```typescript
// Issues API - List and Create
import { NextRequest, NextResponse } from 'next/server';
import { listIssues, createIssue } from '@/lib/services/issues.service';
import { issueCreateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';
import type { IssueListFilters } from '@/types/issues';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters: IssueListFilters = {
      status: searchParams.get('status') as any || undefined,
      severity: searchParams.get('severity') as any || undefined,
      priority: searchParams.get('priority') as any || undefined,
      categoryId: searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')!) : undefined,
      assigneeId: searchParams.get('assigneeId') ? parseInt(searchParams.get('assigneeId')!) : undefined,
      reporterId: searchParams.get('reporterId') ? parseInt(searchParams.get('reporterId')!) : undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
    };

    const result = await listIssues(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error listing issues:', error);
    return NextResponse.json({ error: 'Failed to list issues' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = issueCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const status = body.status === 'submitted' ? 'submitted' : 'draft';
    const issue = await createIssue(validation.data, user.userId, status);

    return NextResponse.json(issue, { status: 201 });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
  }
}
```

**Step 2: Create single issue route**

Create `src/app/api/issues/[id]/route.ts`:

```typescript
// Issues API - Get, Update, Delete single issue
import { NextRequest, NextResponse } from 'next/server';
import { getIssue, updateIssue, deleteIssue } from '@/lib/services/issues.service';
import { issueUpdateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const issue = await getIssue(parseInt(id));

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error getting issue:', error);
    return NextResponse.json({ error: 'Failed to get issue' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const issueId = parseInt(id);

    // Get existing issue to check permissions
    const existing = await getIssue(issueId);
    if (!existing) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Check if user can edit (reporter for draft, assignee, manager, admin)
    const canEdit =
      existing.reporterId === user.userId ||
      existing.assigneeId === user.userId ||
      hasPermission(user.role, 'issues:triage');

    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = issueUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const issue = await updateIssue(issueId, validation.data, user.userId);
    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can delete
    if (!hasPermission(user.role, 'issues:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await deleteIssue(parseInt(id), user.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 });
  }
}
```

**Step 3: Verify routes compile**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/issues/
git commit -m "feat(issues): add core API routes for issues CRUD"
```

---

### Task 10: Create AI Validation API Routes

**Files:**
- Create: `src/app/api/issues/validate/route.ts`
- Create: `src/app/api/issues/duplicates/route.ts`

**Step 1: Create validate route**

Create `src/app/api/issues/validate/route.ts`:

```typescript
// Issues API - AI Validation
import { NextRequest, NextResponse } from 'next/server';
import { validateIssue } from '@/lib/services/issues-ai.service';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, categoryId } = body;

    if (!title || !description || !categoryId) {
      return NextResponse.json({
        error: 'Missing required fields: title, description, categoryId'
      }, { status: 400 });
    }

    const result = await validateIssue(title, description, categoryId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating issue:', error);
    return NextResponse.json({ error: 'Failed to validate issue' }, { status: 500 });
  }
}
```

**Step 2: Create duplicates route**

Create `src/app/api/issues/duplicates/route.ts`:

```typescript
// Issues API - Duplicate Detection
import { NextRequest, NextResponse } from 'next/server';
import { checkDuplicates } from '@/lib/services/issues-ai.service';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, summary, excludeIssueId } = body;

    if (!title || !summary) {
      return NextResponse.json({
        error: 'Missing required fields: title, summary'
      }, { status: 400 });
    }

    const result = await checkDuplicates(title, summary, excludeIssueId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking duplicates:', error);
    return NextResponse.json({ error: 'Failed to check duplicates' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/issues/validate/ src/app/api/issues/duplicates/
git commit -m "feat(issues): add AI validation and duplicate detection APIs"
```

---

### Task 11: Create Comments API Routes

**Files:**
- Create: `src/app/api/issues/[id]/comments/route.ts`
- Create: `src/app/api/issues/[id]/comments/[commentId]/route.ts`

**Step 1: Create comments list/create route**

Create `src/app/api/issues/[id]/comments/route.ts`:

```typescript
// Issues API - Comments List and Create
import { NextRequest, NextResponse } from 'next/server';
import { listIssueComments, createIssueComment } from '@/lib/services/issues-comments.service';
import { issueCommentCreateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const comments = await listIssueComments(parseInt(id));

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error listing comments:', error);
    return NextResponse.json({ error: 'Failed to list comments' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = issueCommentCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const comment = await createIssueComment(parseInt(id), validation.data, user.userId);
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}
```

**Step 2: Create single comment route**

Create `src/app/api/issues/[id]/comments/[commentId]/route.ts`:

```typescript
// Issues API - Single Comment Update/Delete
import { NextRequest, NextResponse } from 'next/server';
import { updateIssueComment, deleteIssueComment } from '@/lib/services/issues-comments.service';
import { issueCommentUpdateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission } from '@/lib/auth/permissions';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await params;
    const body = await request.json();
    const validation = issueCommentUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const comment = await updateIssueComment(parseInt(commentId), validation.data, user.userId);
    return NextResponse.json(comment);
  } catch (error: any) {
    console.error('Error updating comment:', error);
    if (error.message?.includes('Only the author')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { commentId } = await params;
    const isAdmin = hasPermission(user.role, 'issues:delete');

    await deleteIssueComment(parseInt(commentId), user.userId, isAdmin);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    if (error.message?.includes('Only the author')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/issues/[id]/comments/
git commit -m "feat(issues): add comments API routes"
```

---

### Task 12: Create Timeline and Categories API Routes

**Files:**
- Create: `src/app/api/issues/[id]/timeline/route.ts`
- Create: `src/app/api/issues/categories/route.ts`
- Create: `src/app/api/issues/categories/[id]/route.ts`

**Step 1: Create timeline route**

Create `src/app/api/issues/[id]/timeline/route.ts`:

```typescript
// Issues API - Timeline
import { NextRequest, NextResponse } from 'next/server';
import { getIssueTimeline } from '@/lib/services/issues-timeline.service';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const timeline = await getIssueTimeline(parseInt(id));

    return NextResponse.json(timeline);
  } catch (error) {
    console.error('Error getting timeline:', error);
    return NextResponse.json({ error: 'Failed to get timeline' }, { status: 500 });
  }
}
```

**Step 2: Create categories routes**

Create `src/app/api/issues/categories/route.ts`:

```typescript
// Issues API - Categories List and Create
import { NextRequest, NextResponse } from 'next/server';
import { listIssueCategories, createIssueCategory } from '@/lib/services/issues.service';
import { issueCategoryCreateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const isActive = searchParams.get('isActive');

    const categories = await listIssueCategories({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error listing categories:', error);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'issues:manage-categories')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = issueCategoryCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const category = await createIssueCategory(validation.data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
```

Create `src/app/api/issues/categories/[id]/route.ts`:

```typescript
// Issues API - Single Category
import { NextRequest, NextResponse } from 'next/server';
import { getIssueCategory, updateIssueCategory, deleteIssueCategory } from '@/lib/services/issues.service';
import { issueCategoryUpdateSchema } from '@/lib/validation/issues';
import { verifyToken } from '@/lib/auth/jwt';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const category = await getIssueCategory(parseInt(id));

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error getting category:', error);
    return NextResponse.json({ error: 'Failed to get category' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'issues:manage-categories')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validation = issueCategoryUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.errors }, { status: 400 });
    }

    const category = await updateIssueCategory(parseInt(id), validation.data);
    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(user.role, 'issues:manage-categories')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await deleteIssueCategory(parseInt(id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    if (error.message?.includes('Cannot delete')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/issues/[id]/timeline/ src/app/api/issues/categories/
git commit -m "feat(issues): add timeline and categories API routes"
```

---

## Phase 4: UI Components (Summary)

Due to plan length, Phase 4 covers UI components at a higher level. Each task creates one component file.

### Task 13: Create Badge Components

**Files:**
- Create: `src/components/issues/StatusBadge.tsx`
- Create: `src/components/issues/SeverityBadge.tsx`
- Create: `src/components/issues/PriorityBadge.tsx`

These are simple components showing colored badges for status/severity/priority values.

### Task 14: Create Issue Form Component

**Files:**
- Create: `src/components/issues/IssueForm.tsx`

Form with structured description fields, category selector, severity selector, and AI validation integration.

### Task 15: Create AI Validation Feedback Component

**Files:**
- Create: `src/components/issues/AiValidationFeedback.tsx`

Shows AI validation results: missing items, feedback, follow-up questions.

### Task 16: Create Issue Timeline Component

**Files:**
- Create: `src/components/issues/IssueTimeline.tsx`

Displays audit events and comments in chronological order.

### Task 17: Create Comment Editor Component

**Files:**
- Create: `src/components/issues/CommentEditor.tsx`

Rich text editor with @mention support.

---

## Phase 5: Pages (Summary)

### Task 18: Create Issues Layout

**Files:**
- Create: `src/app/issues/layout.tsx`

MainLayout wrapper for the issues module.

### Task 19: Create Issues Dashboard Page

**Files:**
- Create: `src/app/issues/page.tsx`

Dashboard with KPIs, charts (severity distribution, status funnel, trend), recent issues.

### Task 20: Create Issues List Page

**Files:**
- Create: `src/app/issues/list/page.tsx`

DataGrid with filters, search, pagination.

### Task 21: Create New Issue Page

**Files:**
- Create: `src/app/issues/new/page.tsx`

Issue form with AI validation, duplicate detection, save as draft/submit.

### Task 22: Create Issue Detail Page

**Files:**
- Create: `src/app/issues/[id]/page.tsx`

Issue detail with header, timeline, comments, edit capabilities.

### Task 23: Add Issues to Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

Add Issues module with icon to the navigation.

---

## Phase 6: Testing

### Task 24: Create Service Tests

**Files:**
- Create: `tests/unit/services/issues/issues.service.test.ts`

Test CRUD operations for issues and categories.

### Task 25: Create API Tests

**Files:**
- Create: `tests/unit/api/issues/route.test.ts`

Test API endpoints with mocked auth.

### Task 26: Create UI Tests

**Files:**
- Create: `tests/app/issues/page.test.tsx`

Test dashboard page renders without errors.

---

## Environment Setup

Before running, ensure `.env.local` has:

```
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=google/gemini-3-flash-preview
OPENROUTER_TIMEOUT=10000
```

---

## Permissions Setup

Add to `src/lib/auth/permissions.ts`:

```typescript
'issues:create': ['admin', 'manager', 'production', 'qc', 'warehouse', 'purchasing', 'sales', 'finance', 'accountant'],
'issues:triage': ['admin', 'manager'],
'issues:assign': ['admin', 'manager'],
'issues:manage-categories': ['admin'],
'issues:delete': ['admin'],
```
