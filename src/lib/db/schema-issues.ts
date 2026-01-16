// Issue Tracker Schema
// Feature: Issue tracking system for GMP compliance

import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { mysqlTable, varchar, int, datetime, boolean as mysqlBoolean, text as mysqlText, type AnyMySqlColumn } from 'drizzle-orm/mysql-core';
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
  type: text('type').notNull(), // 'software' | 'operational'
  requiredFields: text('required_fields').notNull().default('[]'), // JSON array of required field names
  aiPrompt: text('ai_prompt'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issues (main table)
export const sqliteIssues = sqliteTable('issues', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueNumber: text('issue_number').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default('{}'), // JSON: IssueDescription
  categoryId: integer('category_id').references(() => sqliteIssueCategories.id),
  severity: text('severity').notNull(), // 'critical' | 'major' | 'minor'
  priority: text('priority'), // 'immediate' | 'urgent' | 'scheduled' | 'backlog'
  status: text('status').notNull().default('draft'), // 'draft' | 'submitted' | 'triaged' | 'in_progress' | 'resolved' | 'verified' | 'closed'
  reporterId: integer('reporter_id').notNull().references(() => sqliteUsers.id),
  assigneeId: integer('assignee_id').references(() => sqliteUsers.id),
  aiValidationPassed: integer('ai_validation_passed', { mode: 'boolean' }).notNull().default(false),
  aiValidationSkipped: integer('ai_validation_skipped', { mode: 'boolean' }).notNull().default(false),
  duplicateOfId: integer('duplicate_of_id').references((): AnySQLiteColumn => sqliteIssues.id),
  resolvedAt: text('resolved_at'),
  verifiedAt: text('verified_at'),
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Tags
export const sqliteIssueTags = sqliteTable('issue_tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#3B82F6'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Tag Links (many-to-many)
export const sqliteIssueTagLinks = sqliteTable('issue_tag_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => sqliteIssueTags.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Comments
export const sqliteIssueComments = sqliteTable('issue_comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id, { onDelete: 'cascade' }),
  authorId: integer('author_id').notNull().references(() => sqliteUsers.id),
  content: text('content').notNull(),
  mentionedUserIds: text('mentioned_user_ids').notNull().default('[]'), // JSON array of user IDs
  isEdited: integer('is_edited', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Attachments
export const sqliteIssueAttachments = sqliteTable('issue_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').references(() => sqliteIssues.id, { onDelete: 'cascade' }),
  commentId: integer('comment_id').references(() => sqliteIssueComments.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedById: integer('uploaded_by_id').notNull().references(() => sqliteUsers.id),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Audit Events
export const sqliteIssueAuditEvents = sqliteTable('issue_audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // IssueAuditEventType
  actorId: integer('actor_id').notNull().references(() => sqliteUsers.id),
  oldValue: text('old_value'), // JSON
  newValue: text('new_value'), // JSON
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Issue Notifications
export const sqliteIssueNotifications = sqliteTable('issue_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => sqliteUsers.id, { onDelete: 'cascade' }),
  issueId: integer('issue_id').notNull().references(() => sqliteIssues.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // IssueNotificationType
  message: text('message').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
  emailSent: integer('email_sent', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// SQLite Relations
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
    relationName: 'issueReporter',
  }),
  assignee: one(sqliteUsers, {
    fields: [sqliteIssues.assigneeId],
    references: [sqliteUsers.id],
    relationName: 'issueAssignee',
  }),
  duplicateOf: one(sqliteIssues, {
    fields: [sqliteIssues.duplicateOfId],
    references: [sqliteIssues.id],
    relationName: 'issueDuplicates',
  }),
  comments: many(sqliteIssueComments),
  attachments: many(sqliteIssueAttachments),
  auditEvents: many(sqliteIssueAuditEvents),
  tagLinks: many(sqliteIssueTagLinks),
  notifications: many(sqliteIssueNotifications),
}));

export const sqliteIssueTagsRelations = relations(sqliteIssueTags, ({ many }) => ({
  tagLinks: many(sqliteIssueTagLinks),
}));

export const sqliteIssueTagLinksRelations = relations(sqliteIssueTagLinks, ({ one }) => ({
  issue: one(sqliteIssues, {
    fields: [sqliteIssueTagLinks.issueId],
    references: [sqliteIssues.id],
  }),
  tag: one(sqliteIssueTags, {
    fields: [sqliteIssueTagLinks.tagId],
    references: [sqliteIssueTags.id],
  }),
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

export const sqliteIssueAttachmentsRelations = relations(sqliteIssueAttachments, ({ one }) => ({
  issue: one(sqliteIssues, {
    fields: [sqliteIssueAttachments.issueId],
    references: [sqliteIssues.id],
  }),
  comment: one(sqliteIssueComments, {
    fields: [sqliteIssueAttachments.commentId],
    references: [sqliteIssueComments.id],
  }),
  uploadedBy: one(sqliteUsers, {
    fields: [sqliteIssueAttachments.uploadedById],
    references: [sqliteUsers.id],
  }),
}));

export const sqliteIssueAuditEventsRelations = relations(sqliteIssueAuditEvents, ({ one }) => ({
  issue: one(sqliteIssues, {
    fields: [sqliteIssueAuditEvents.issueId],
    references: [sqliteIssues.id],
  }),
  actor: one(sqliteUsers, {
    fields: [sqliteIssueAuditEvents.actorId],
    references: [sqliteUsers.id],
  }),
}));

export const sqliteIssueNotificationsRelations = relations(sqliteIssueNotifications, ({ one }) => ({
  user: one(sqliteUsers, {
    fields: [sqliteIssueNotifications.userId],
    references: [sqliteUsers.id],
  }),
  issue: one(sqliteIssues, {
    fields: [sqliteIssueNotifications.issueId],
    references: [sqliteIssues.id],
  }),
}));

// ============================================
// MySQL Schema (for production)
// ============================================

// Issue Categories
export const mysqlIssueCategories = mysqlTable('issue_categories', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  type: varchar('type', { length: 20 }).notNull(), // 'software' | 'operational'
  requiredFields: mysqlText('required_fields').notNull().default('[]'), // JSON array of required field names
  aiPrompt: mysqlText('ai_prompt'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Issues (main table)
export const mysqlIssues = mysqlTable('issues', {
  id: int('id').primaryKey().autoincrement(),
  issueNumber: varchar('issue_number', { length: 20 }).notNull().unique(),
  title: varchar('title', { length: 500 }).notNull(),
  description: mysqlText('description').notNull(), // JSON: IssueDescription
  categoryId: int('category_id').references(() => mysqlIssueCategories.id),
  severity: varchar('severity', { length: 20 }).notNull(), // 'critical' | 'major' | 'minor'
  priority: varchar('priority', { length: 20 }), // 'immediate' | 'urgent' | 'scheduled' | 'backlog'
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  reporterId: int('reporter_id').notNull().references(() => mysqlUsers.id),
  assigneeId: int('assignee_id').references(() => mysqlUsers.id),
  aiValidationPassed: mysqlBoolean('ai_validation_passed').notNull().default(false),
  aiValidationSkipped: mysqlBoolean('ai_validation_skipped').notNull().default(false),
  duplicateOfId: int('duplicate_of_id').references((): AnyMySqlColumn => mysqlIssues.id),
  resolvedAt: datetime('resolved_at'),
  verifiedAt: datetime('verified_at'),
  closedAt: datetime('closed_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Issue Tags
export const mysqlIssueTags = mysqlTable('issue_tags', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Issue Tag Links (many-to-many)
export const mysqlIssueTagLinks = mysqlTable('issue_tag_links', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id, { onDelete: 'cascade' }),
  tagId: int('tag_id').notNull().references(() => mysqlIssueTags.id, { onDelete: 'cascade' }),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Issue Comments
export const mysqlIssueComments = mysqlTable('issue_comments', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id, { onDelete: 'cascade' }),
  authorId: int('author_id').notNull().references(() => mysqlUsers.id),
  content: mysqlText('content').notNull(),
  mentionedUserIds: mysqlText('mentioned_user_ids').notNull().default('[]'), // JSON array of user IDs
  isEdited: mysqlBoolean('is_edited').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Issue Attachments
export const mysqlIssueAttachments = mysqlTable('issue_attachments', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').references(() => mysqlIssues.id, { onDelete: 'cascade' }),
  commentId: int('comment_id').references(() => mysqlIssueComments.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSize: int('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  uploadedById: int('uploaded_by_id').notNull().references(() => mysqlUsers.id),
  isDeleted: mysqlBoolean('is_deleted').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Issue Audit Events
export const mysqlIssueAuditEvents = mysqlTable('issue_audit_events', {
  id: int('id').primaryKey().autoincrement(),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 30 }).notNull(), // IssueAuditEventType
  actorId: int('actor_id').notNull().references(() => mysqlUsers.id),
  oldValue: mysqlText('old_value'), // JSON
  newValue: mysqlText('new_value'), // JSON
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Issue Notifications
export const mysqlIssueNotifications = mysqlTable('issue_notifications', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id').notNull().references(() => mysqlUsers.id, { onDelete: 'cascade' }),
  issueId: int('issue_id').notNull().references(() => mysqlIssues.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(), // IssueNotificationType
  message: varchar('message', { length: 500 }).notNull(),
  isRead: mysqlBoolean('is_read').notNull().default(false),
  emailSent: mysqlBoolean('email_sent').notNull().default(false),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// ============================================
// MySQL Relations
// ============================================

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
    relationName: 'issueReporter',
  }),
  assignee: one(mysqlUsers, {
    fields: [mysqlIssues.assigneeId],
    references: [mysqlUsers.id],
    relationName: 'issueAssignee',
  }),
  duplicateOf: one(mysqlIssues, {
    fields: [mysqlIssues.duplicateOfId],
    references: [mysqlIssues.id],
    relationName: 'issueDuplicates',
  }),
  comments: many(mysqlIssueComments),
  attachments: many(mysqlIssueAttachments),
  auditEvents: many(mysqlIssueAuditEvents),
  tagLinks: many(mysqlIssueTagLinks),
  notifications: many(mysqlIssueNotifications),
}));

export const mysqlIssueTagsRelations = relations(mysqlIssueTags, ({ many }) => ({
  tagLinks: many(mysqlIssueTagLinks),
}));

export const mysqlIssueTagLinksRelations = relations(mysqlIssueTagLinks, ({ one }) => ({
  issue: one(mysqlIssues, {
    fields: [mysqlIssueTagLinks.issueId],
    references: [mysqlIssues.id],
  }),
  tag: one(mysqlIssueTags, {
    fields: [mysqlIssueTagLinks.tagId],
    references: [mysqlIssueTags.id],
  }),
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

export const mysqlIssueAttachmentsRelations = relations(mysqlIssueAttachments, ({ one }) => ({
  issue: one(mysqlIssues, {
    fields: [mysqlIssueAttachments.issueId],
    references: [mysqlIssues.id],
  }),
  comment: one(mysqlIssueComments, {
    fields: [mysqlIssueAttachments.commentId],
    references: [mysqlIssueComments.id],
  }),
  uploadedBy: one(mysqlUsers, {
    fields: [mysqlIssueAttachments.uploadedById],
    references: [mysqlUsers.id],
  }),
}));

export const mysqlIssueAuditEventsRelations = relations(mysqlIssueAuditEvents, ({ one }) => ({
  issue: one(mysqlIssues, {
    fields: [mysqlIssueAuditEvents.issueId],
    references: [mysqlIssues.id],
  }),
  actor: one(mysqlUsers, {
    fields: [mysqlIssueAuditEvents.actorId],
    references: [mysqlUsers.id],
  }),
}));

export const mysqlIssueNotificationsRelations = relations(mysqlIssueNotifications, ({ one }) => ({
  user: one(mysqlUsers, {
    fields: [mysqlIssueNotifications.userId],
    references: [mysqlUsers.id],
  }),
  issue: one(mysqlIssues, {
    fields: [mysqlIssueNotifications.issueId],
    references: [mysqlIssues.id],
  }),
}));

// ============================================
// Type Exports (inferred from SQLite schema)
// ============================================

export type IssueCategoryDb = typeof sqliteIssueCategories.$inferSelect;
export type NewIssueCategoryDb = typeof sqliteIssueCategories.$inferInsert;
export type IssueDb = typeof sqliteIssues.$inferSelect;
export type NewIssueDb = typeof sqliteIssues.$inferInsert;
export type IssueTagDb = typeof sqliteIssueTags.$inferSelect;
export type NewIssueTagDb = typeof sqliteIssueTags.$inferInsert;
export type IssueTagLinkDb = typeof sqliteIssueTagLinks.$inferSelect;
export type NewIssueTagLinkDb = typeof sqliteIssueTagLinks.$inferInsert;
export type IssueCommentDb = typeof sqliteIssueComments.$inferSelect;
export type NewIssueCommentDb = typeof sqliteIssueComments.$inferInsert;
export type IssueAttachmentDb = typeof sqliteIssueAttachments.$inferSelect;
export type NewIssueAttachmentDb = typeof sqliteIssueAttachments.$inferInsert;
export type IssueAuditEventDb = typeof sqliteIssueAuditEvents.$inferSelect;
export type NewIssueAuditEventDb = typeof sqliteIssueAuditEvents.$inferInsert;
export type IssueNotificationDb = typeof sqliteIssueNotifications.$inferSelect;
export type NewIssueNotificationDb = typeof sqliteIssueNotifications.$inferInsert;
