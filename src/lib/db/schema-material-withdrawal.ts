// Material Withdrawal Approval Module Schema
// Feature: 018-material-withdrawal-approval
//
// Workflow: operator submits a request for additional material beyond planned BOM,
// supervisor approves/rejects with E-signature. On approve: stock deducted,
// deviation created, material consumption updated, affected phase unblocked.
//
// Tables:
//   - material_withdrawal_requests       (header)
//   - material_withdrawal_request_items  (lines, FK cascade)
//   - material_withdrawal_approvals      (1:1 approval action, signature_id FK)
//   - material_withdrawal_attachments    (photos, FK cascade)
//   - material_withdrawal_rules          (soft/hard cap config, hierarchical lookup)

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import {
  mysqlTable,
  varchar,
  int,
  decimal,
  datetime,
  text as mysqlText,
  boolean as mysqlBoolean,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import {
  sqliteUsers,
  mysqlUsers,
  sqliteWorkOrders,
  mysqlWorkOrders,
  sqliteItems,
  mysqlItems,
  sqliteProductionRooms,
  mysqlProductionRooms,
  sqliteElectronicSignatures,
  mysqlElectronicSignatures,
} from './schema';

// ============================================
// SQLite Schema (for unit testing)
// ============================================

// Material Withdrawal Requests — header
// Status flow: pending -> approved | rejected | cancelled
export const sqliteMaterialWithdrawalRequests = sqliteTable('material_withdrawal_requests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id')
    .notNull()
    .references(() => sqliteWorkOrders.id),
  // Factory code for multi-tenant scoping (nullable for now — current build is single-tenant per container)
  factoryCode: text('factory_code'),
  requestedByUserId: integer('requested_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  requestedAt: text('requested_at').notNull().default('CURRENT_TIMESTAMP'),
  // pending | approved | rejected | cancelled
  status: text('status').notNull().default('pending'),
  // machine_setup_loss | equipment_trial_run | parameter_adjustment | other
  reasonType: text('reason_type').notNull(),
  // Required when reasonType=other
  reasonDetail: text('reason_detail'),
  // Required when reasonType=machine_setup_loss
  machinePhase: text('machine_phase'),
  roomId: integer('room_id')
    .notNull()
    .references(() => sqliteProductionRooms.id),
  cancelledReason: text('cancelled_reason'),
  // Idempotency: hash of (workOrderId + items + reasonType) used to dedupe within 30s
  payloadHash: text('payload_hash'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Material Withdrawal Request Items — line items
export const sqliteMaterialWithdrawalRequestItems = sqliteTable('material_withdrawal_request_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: integer('request_id')
    .notNull()
    .references(() => sqliteMaterialWithdrawalRequests.id, { onDelete: 'cascade' }),
  // FK to items table (the BOM material)
  materialId: integer('material_id')
    .notNull()
    .references(() => sqliteItems.id),
  quantityRequested: real('quantity_requested').notNull(),
  // Filled on approve; supervisor may approve a lesser amount
  quantityApproved: real('quantity_approved'),
  unit: text('unit').notNull(),
  // Snapshot of BOM planned qty (traceability)
  bomPlannedQuantity: real('bom_planned_quantity').notNull(),
  // Denormalized cumulative for fast cap check after approve
  cumulativeExtraAfterApprove: real('cumulative_extra_after_approve'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Material Withdrawal Approvals — single action per request
export const sqliteMaterialWithdrawalApprovals = sqliteTable('material_withdrawal_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // UNIQUE — enforce 1 approval per request
  requestId: integer('request_id')
    .notNull()
    .unique()
    .references(() => sqliteMaterialWithdrawalRequests.id),
  approverUserId: integer('approver_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  // approve | reject
  action: text('action').notNull(),
  actionAt: text('action_at').notNull().default('CURRENT_TIMESTAMP'),
  // Required when action=reject
  reason: text('reason'),
  // Optional comment on approve
  comment: text('comment'),
  signatureId: integer('signature_id')
    .notNull()
    .references(() => sqliteElectronicSignatures.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Material Withdrawal Attachments — photo/evidence
export const sqliteMaterialWithdrawalAttachments = sqliteTable('material_withdrawal_attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requestId: integer('request_id')
    .notNull()
    .references(() => sqliteMaterialWithdrawalRequests.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  uploadedByUserId: integer('uploaded_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  uploadedAt: text('uploaded_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Material Withdrawal Rules — soft/hard cap config per (factory, category)
// Lookup precedence: (factory, category) -> (factory, NULL) -> (NULL, category) -> (NULL, NULL = global default)
export const sqliteMaterialWithdrawalRules = sqliteTable('material_withdrawal_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // Nullable: NULL = any factory
  factoryCode: text('factory_code'),
  // Nullable: NULL = any material category
  // Values: active_ingredient | excipient | packaging | other
  materialCategory: text('material_category'),
  softCapPercent: real('soft_cap_percent').notNull().default(10.0),
  hardCapPercent: real('hard_cap_percent').notNull().default(50.0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: integer('created_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ---------- SQLite Relations ----------

export const sqliteMaterialWithdrawalRequestsRelations = relations(
  sqliteMaterialWithdrawalRequests,
  ({ one, many }) => ({
    workOrder: one(sqliteWorkOrders, {
      fields: [sqliteMaterialWithdrawalRequests.workOrderId],
      references: [sqliteWorkOrders.id],
    }),
    requester: one(sqliteUsers, {
      fields: [sqliteMaterialWithdrawalRequests.requestedByUserId],
      references: [sqliteUsers.id],
    }),
    room: one(sqliteProductionRooms, {
      fields: [sqliteMaterialWithdrawalRequests.roomId],
      references: [sqliteProductionRooms.id],
    }),
    items: many(sqliteMaterialWithdrawalRequestItems),
    attachments: many(sqliteMaterialWithdrawalAttachments),
    approval: one(sqliteMaterialWithdrawalApprovals, {
      fields: [sqliteMaterialWithdrawalRequests.id],
      references: [sqliteMaterialWithdrawalApprovals.requestId],
    }),
  })
);

export const sqliteMaterialWithdrawalRequestItemsRelations = relations(
  sqliteMaterialWithdrawalRequestItems,
  ({ one }) => ({
    request: one(sqliteMaterialWithdrawalRequests, {
      fields: [sqliteMaterialWithdrawalRequestItems.requestId],
      references: [sqliteMaterialWithdrawalRequests.id],
    }),
    material: one(sqliteItems, {
      fields: [sqliteMaterialWithdrawalRequestItems.materialId],
      references: [sqliteItems.id],
    }),
  })
);

export const sqliteMaterialWithdrawalApprovalsRelations = relations(
  sqliteMaterialWithdrawalApprovals,
  ({ one }) => ({
    request: one(sqliteMaterialWithdrawalRequests, {
      fields: [sqliteMaterialWithdrawalApprovals.requestId],
      references: [sqliteMaterialWithdrawalRequests.id],
    }),
    approver: one(sqliteUsers, {
      fields: [sqliteMaterialWithdrawalApprovals.approverUserId],
      references: [sqliteUsers.id],
    }),
    signature: one(sqliteElectronicSignatures, {
      fields: [sqliteMaterialWithdrawalApprovals.signatureId],
      references: [sqliteElectronicSignatures.id],
    }),
  })
);

export const sqliteMaterialWithdrawalAttachmentsRelations = relations(
  sqliteMaterialWithdrawalAttachments,
  ({ one }) => ({
    request: one(sqliteMaterialWithdrawalRequests, {
      fields: [sqliteMaterialWithdrawalAttachments.requestId],
      references: [sqliteMaterialWithdrawalRequests.id],
    }),
    uploadedBy: one(sqliteUsers, {
      fields: [sqliteMaterialWithdrawalAttachments.uploadedByUserId],
      references: [sqliteUsers.id],
    }),
  })
);

export const sqliteMaterialWithdrawalRulesRelations = relations(
  sqliteMaterialWithdrawalRules,
  ({ one }) => ({
    createdBy: one(sqliteUsers, {
      fields: [sqliteMaterialWithdrawalRules.createdByUserId],
      references: [sqliteUsers.id],
    }),
  })
);

// ============================================
// MySQL Schema (for production)
// ============================================

export const mysqlMaterialWithdrawalRequests = mysqlTable('material_withdrawal_requests', {
  id: int('id').primaryKey().autoincrement(),
  workOrderId: int('work_order_id')
    .notNull()
    .references(() => mysqlWorkOrders.id),
  factoryCode: varchar('factory_code', { length: 40 }),
  requestedByUserId: int('requested_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  requestedAt: datetime('requested_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  reasonType: varchar('reason_type', { length: 40 }).notNull(),
  reasonDetail: mysqlText('reason_detail'),
  machinePhase: varchar('machine_phase', { length: 80 }),
  roomId: int('room_id')
    .notNull()
    .references(() => mysqlProductionRooms.id),
  cancelledReason: mysqlText('cancelled_reason'),
  payloadHash: varchar('payload_hash', { length: 64 }),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlMaterialWithdrawalRequestItems = mysqlTable('material_withdrawal_request_items', {
  id: int('id').primaryKey().autoincrement(),
  requestId: int('request_id')
    .notNull()
    .references(() => mysqlMaterialWithdrawalRequests.id, { onDelete: 'cascade' }),
  materialId: int('material_id')
    .notNull()
    .references(() => mysqlItems.id),
  quantityRequested: decimal('quantity_requested', { precision: 18, scale: 4 }).notNull(),
  quantityApproved: decimal('quantity_approved', { precision: 18, scale: 4 }),
  unit: varchar('unit', { length: 20 }).notNull(),
  bomPlannedQuantity: decimal('bom_planned_quantity', { precision: 18, scale: 4 }).notNull(),
  cumulativeExtraAfterApprove: decimal('cumulative_extra_after_approve', {
    precision: 18,
    scale: 4,
  }),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlMaterialWithdrawalApprovals = mysqlTable('material_withdrawal_approvals', {
  id: int('id').primaryKey().autoincrement(),
  requestId: int('request_id')
    .notNull()
    .unique()
    .references(() => mysqlMaterialWithdrawalRequests.id),
  approverUserId: int('approver_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  action: varchar('action', { length: 10 }).notNull(),
  actionAt: datetime('action_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  reason: mysqlText('reason'),
  comment: mysqlText('comment'),
  signatureId: int('signature_id')
    .notNull()
    .references(() => mysqlElectronicSignatures.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlMaterialWithdrawalAttachments = mysqlTable('material_withdrawal_attachments', {
  id: int('id').primaryKey().autoincrement(),
  requestId: int('request_id')
    .notNull()
    .references(() => mysqlMaterialWithdrawalRequests.id, { onDelete: 'cascade' }),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 80 }).notNull(),
  sizeBytes: int('size_bytes').notNull(),
  uploadedByUserId: int('uploaded_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  uploadedAt: datetime('uploaded_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlMaterialWithdrawalRules = mysqlTable('material_withdrawal_rules', {
  id: int('id').primaryKey().autoincrement(),
  factoryCode: varchar('factory_code', { length: 40 }),
  materialCategory: varchar('material_category', { length: 40 }),
  softCapPercent: decimal('soft_cap_percent', { precision: 6, scale: 2 }).notNull().default('10.00'),
  hardCapPercent: decimal('hard_cap_percent', { precision: 6, scale: 2 }).notNull().default('50.00'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdByUserId: int('created_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- MySQL Relations ----------

export const mysqlMaterialWithdrawalRequestsRelations = relations(
  mysqlMaterialWithdrawalRequests,
  ({ one, many }) => ({
    workOrder: one(mysqlWorkOrders, {
      fields: [mysqlMaterialWithdrawalRequests.workOrderId],
      references: [mysqlWorkOrders.id],
    }),
    requester: one(mysqlUsers, {
      fields: [mysqlMaterialWithdrawalRequests.requestedByUserId],
      references: [mysqlUsers.id],
    }),
    room: one(mysqlProductionRooms, {
      fields: [mysqlMaterialWithdrawalRequests.roomId],
      references: [mysqlProductionRooms.id],
    }),
    items: many(mysqlMaterialWithdrawalRequestItems),
    attachments: many(mysqlMaterialWithdrawalAttachments),
    approval: one(mysqlMaterialWithdrawalApprovals, {
      fields: [mysqlMaterialWithdrawalRequests.id],
      references: [mysqlMaterialWithdrawalApprovals.requestId],
    }),
  })
);

export const mysqlMaterialWithdrawalRequestItemsRelations = relations(
  mysqlMaterialWithdrawalRequestItems,
  ({ one }) => ({
    request: one(mysqlMaterialWithdrawalRequests, {
      fields: [mysqlMaterialWithdrawalRequestItems.requestId],
      references: [mysqlMaterialWithdrawalRequests.id],
    }),
    material: one(mysqlItems, {
      fields: [mysqlMaterialWithdrawalRequestItems.materialId],
      references: [mysqlItems.id],
    }),
  })
);

export const mysqlMaterialWithdrawalApprovalsRelations = relations(
  mysqlMaterialWithdrawalApprovals,
  ({ one }) => ({
    request: one(mysqlMaterialWithdrawalRequests, {
      fields: [mysqlMaterialWithdrawalApprovals.requestId],
      references: [mysqlMaterialWithdrawalRequests.id],
    }),
    approver: one(mysqlUsers, {
      fields: [mysqlMaterialWithdrawalApprovals.approverUserId],
      references: [mysqlUsers.id],
    }),
    signature: one(mysqlElectronicSignatures, {
      fields: [mysqlMaterialWithdrawalApprovals.signatureId],
      references: [mysqlElectronicSignatures.id],
    }),
  })
);

export const mysqlMaterialWithdrawalAttachmentsRelations = relations(
  mysqlMaterialWithdrawalAttachments,
  ({ one }) => ({
    request: one(mysqlMaterialWithdrawalRequests, {
      fields: [mysqlMaterialWithdrawalAttachments.requestId],
      references: [mysqlMaterialWithdrawalRequests.id],
    }),
    uploadedBy: one(mysqlUsers, {
      fields: [mysqlMaterialWithdrawalAttachments.uploadedByUserId],
      references: [mysqlUsers.id],
    }),
  })
);

export const mysqlMaterialWithdrawalRulesRelations = relations(
  mysqlMaterialWithdrawalRules,
  ({ one }) => ({
    createdBy: one(mysqlUsers, {
      fields: [mysqlMaterialWithdrawalRules.createdByUserId],
      references: [mysqlUsers.id],
    }),
  })
);

// ============================================
// TypeScript Types (inferred)
// ============================================

export type MaterialWithdrawalRequestDb = typeof sqliteMaterialWithdrawalRequests.$inferSelect;
export type NewMaterialWithdrawalRequestDb = typeof sqliteMaterialWithdrawalRequests.$inferInsert;

export type MaterialWithdrawalRequestItemDb = typeof sqliteMaterialWithdrawalRequestItems.$inferSelect;
export type NewMaterialWithdrawalRequestItemDb = typeof sqliteMaterialWithdrawalRequestItems.$inferInsert;

export type MaterialWithdrawalApprovalDb = typeof sqliteMaterialWithdrawalApprovals.$inferSelect;
export type NewMaterialWithdrawalApprovalDb = typeof sqliteMaterialWithdrawalApprovals.$inferInsert;

export type MaterialWithdrawalAttachmentDb = typeof sqliteMaterialWithdrawalAttachments.$inferSelect;
export type NewMaterialWithdrawalAttachmentDb = typeof sqliteMaterialWithdrawalAttachments.$inferInsert;

export type MaterialWithdrawalRuleDb = typeof sqliteMaterialWithdrawalRules.$inferSelect;
export type NewMaterialWithdrawalRuleDb = typeof sqliteMaterialWithdrawalRules.$inferInsert;
