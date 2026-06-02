// Primary Packaging Material Issuance & Return Module Schema
// Feature: 019-primary-packaging
//
// Tables:
//   - wo_packaging_returns          — return records (1 per return event from an issuance)
//   - wo_packaging_return_approvals — QA approval (1:1 with return)
//   - packaging_tolerances          — per-category variance tolerance config

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
  sqliteWOPackagingMaterials,
  mysqlWOPackagingMaterials,
  sqliteElectronicSignatures,
  mysqlElectronicSignatures,
  sqliteInventoryLots,
  mysqlInventoryLots,
  sqliteDeviations,
  mysqlDeviations,
} from './schema';

// ============================================
// SQLite Schema
// ============================================

export const sqliteWoPackagingReturns = sqliteTable('wo_packaging_returns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  woPackagingMaterialId: integer('wo_packaging_material_id')
    .notNull()
    .references(() => sqliteWOPackagingMaterials.id),
  usedQty: integer('used_qty').notNull(),
  returnQty: integer('return_qty').notNull(),
  varianceQty: integer('variance_qty').notNull(),
  variancePercent: real('variance_percent').notNull(),
  outsideTolerance: integer('outside_tolerance', { mode: 'boolean' }).notNull().default(false),
  // sampling | spillage | process_loss | cleaning | damaged | unaccounted | other
  varianceReason: text('variance_reason').notNull(),
  varianceExplanation: text('variance_explanation'),
  returnContainerLabel: text('return_container_label').notNull(),
  // reusable | quarantine | rejected
  proposedStatus: text('proposed_status').notNull(),
  returnerUserId: integer('returner_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  verifierUserId: integer('verifier_user_id').references(() => sqliteUsers.id),
  verifierSignatureId: integer('verifier_signature_id').references(() => sqliteElectronicSignatures.id),
  verifiedAt: text('verified_at'),
  // pending_qa_approval | approved_reusable | approved_quarantine | rejected
  status: text('status').notNull().default('pending_qa_approval'),
  submittedAt: text('submitted_at').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteWoPackagingReturnApprovals = sqliteTable('wo_packaging_return_approvals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  returnId: integer('return_id')
    .notNull()
    .unique()
    .references(() => sqliteWoPackagingReturns.id),
  qaUserId: integer('qa_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  qaSignatureId: integer('qa_signature_id')
    .notNull()
    .references(() => sqliteElectronicSignatures.id),
  // approved_reusable | approved_quarantine | rejected
  finalStatus: text('final_status').notNull(),
  overrideReason: text('override_reason'),
  qaNotes: text('qa_notes'),
  newLotId: integer('new_lot_id').references(() => sqliteInventoryLots.id),
  deviationId: integer('deviation_id').references(() => sqliteDeviations.id),
  actionAt: text('action_at').notNull().default('CURRENT_TIMESTAMP'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqlitePackagingTolerances = sqliteTable('packaging_tolerances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // capsule | bottle | cap | label | other
  packagingCategory: text('packaging_category').notNull().unique(),
  tolerancePercent: real('tolerance_percent').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ---------- SQLite Relations ----------

export const sqliteWoPackagingReturnsRelations = relations(sqliteWoPackagingReturns, ({ one }) => ({
  issuance: one(sqliteWOPackagingMaterials, {
    fields: [sqliteWoPackagingReturns.woPackagingMaterialId],
    references: [sqliteWOPackagingMaterials.id],
  }),
  returner: one(sqliteUsers, {
    fields: [sqliteWoPackagingReturns.returnerUserId],
    references: [sqliteUsers.id],
  }),
  verifier: one(sqliteUsers, {
    fields: [sqliteWoPackagingReturns.verifierUserId],
    references: [sqliteUsers.id],
  }),
  approval: one(sqliteWoPackagingReturnApprovals, {
    fields: [sqliteWoPackagingReturns.id],
    references: [sqliteWoPackagingReturnApprovals.returnId],
  }),
}));

export const sqliteWoPackagingReturnApprovalsRelations = relations(
  sqliteWoPackagingReturnApprovals,
  ({ one }) => ({
    return: one(sqliteWoPackagingReturns, {
      fields: [sqliteWoPackagingReturnApprovals.returnId],
      references: [sqliteWoPackagingReturns.id],
    }),
    qaUser: one(sqliteUsers, {
      fields: [sqliteWoPackagingReturnApprovals.qaUserId],
      references: [sqliteUsers.id],
    }),
    signature: one(sqliteElectronicSignatures, {
      fields: [sqliteWoPackagingReturnApprovals.qaSignatureId],
      references: [sqliteElectronicSignatures.id],
    }),
    newLot: one(sqliteInventoryLots, {
      fields: [sqliteWoPackagingReturnApprovals.newLotId],
      references: [sqliteInventoryLots.id],
    }),
    deviation: one(sqliteDeviations, {
      fields: [sqliteWoPackagingReturnApprovals.deviationId],
      references: [sqliteDeviations.id],
    }),
  })
);

export const sqlitePackagingTolerancesRelations = relations(sqlitePackagingTolerances, ({ one }) => ({
  createdBy: one(sqliteUsers, {
    fields: [sqlitePackagingTolerances.createdByUserId],
    references: [sqliteUsers.id],
  }),
}));

// ============================================
// MySQL Schema
// ============================================

export const mysqlWoPackagingReturns = mysqlTable('wo_packaging_returns', {
  id: int('id').primaryKey().autoincrement(),
  woPackagingMaterialId: int('wo_packaging_material_id')
    .notNull()
    .references(() => mysqlWOPackagingMaterials.id),
  usedQty: int('used_qty').notNull(),
  returnQty: int('return_qty').notNull(),
  varianceQty: int('variance_qty').notNull(),
  variancePercent: decimal('variance_percent', { precision: 8, scale: 4 }).notNull(),
  outsideTolerance: mysqlBoolean('outside_tolerance').notNull().default(false),
  varianceReason: varchar('variance_reason', { length: 40 }).notNull(),
  varianceExplanation: mysqlText('variance_explanation'),
  returnContainerLabel: varchar('return_container_label', { length: 50 }).notNull(),
  proposedStatus: varchar('proposed_status', { length: 20 }).notNull(),
  returnerUserId: int('returner_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  verifierUserId: int('verifier_user_id').references(() => mysqlUsers.id),
  verifierSignatureId: int('verifier_signature_id').references(() => mysqlElectronicSignatures.id),
  verifiedAt: datetime('verified_at'),
  status: varchar('status', { length: 30 }).notNull().default('pending_qa_approval'),
  submittedAt: datetime('submitted_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWoPackagingReturnApprovals = mysqlTable('wo_packaging_return_approvals', {
  id: int('id').primaryKey().autoincrement(),
  returnId: int('return_id')
    .notNull()
    .unique()
    .references(() => mysqlWoPackagingReturns.id),
  qaUserId: int('qa_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  qaSignatureId: int('qa_signature_id')
    .notNull()
    .references(() => mysqlElectronicSignatures.id),
  finalStatus: varchar('final_status', { length: 20 }).notNull(),
  overrideReason: mysqlText('override_reason'),
  qaNotes: mysqlText('qa_notes'),
  newLotId: int('new_lot_id').references(() => mysqlInventoryLots.id),
  deviationId: int('deviation_id').references(() => mysqlDeviations.id),
  actionAt: datetime('action_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlPackagingTolerances = mysqlTable('packaging_tolerances', {
  id: int('id').primaryKey().autoincrement(),
  packagingCategory: varchar('packaging_category', { length: 40 }).notNull().unique(),
  tolerancePercent: decimal('tolerance_percent', { precision: 6, scale: 2 }).notNull(),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  notes: mysqlText('notes'),
  createdByUserId: int('created_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- MySQL Relations ----------

export const mysqlWoPackagingReturnsRelations = relations(mysqlWoPackagingReturns, ({ one }) => ({
  issuance: one(mysqlWOPackagingMaterials, {
    fields: [mysqlWoPackagingReturns.woPackagingMaterialId],
    references: [mysqlWOPackagingMaterials.id],
  }),
  returner: one(mysqlUsers, {
    fields: [mysqlWoPackagingReturns.returnerUserId],
    references: [mysqlUsers.id],
  }),
  verifier: one(mysqlUsers, {
    fields: [mysqlWoPackagingReturns.verifierUserId],
    references: [mysqlUsers.id],
  }),
  approval: one(mysqlWoPackagingReturnApprovals, {
    fields: [mysqlWoPackagingReturns.id],
    references: [mysqlWoPackagingReturnApprovals.returnId],
  }),
}));

export const mysqlWoPackagingReturnApprovalsRelations = relations(
  mysqlWoPackagingReturnApprovals,
  ({ one }) => ({
    return: one(mysqlWoPackagingReturns, {
      fields: [mysqlWoPackagingReturnApprovals.returnId],
      references: [mysqlWoPackagingReturns.id],
    }),
    qaUser: one(mysqlUsers, {
      fields: [mysqlWoPackagingReturnApprovals.qaUserId],
      references: [mysqlUsers.id],
    }),
    signature: one(mysqlElectronicSignatures, {
      fields: [mysqlWoPackagingReturnApprovals.qaSignatureId],
      references: [mysqlElectronicSignatures.id],
    }),
    newLot: one(mysqlInventoryLots, {
      fields: [mysqlWoPackagingReturnApprovals.newLotId],
      references: [mysqlInventoryLots.id],
    }),
    deviation: one(mysqlDeviations, {
      fields: [mysqlWoPackagingReturnApprovals.deviationId],
      references: [mysqlDeviations.id],
    }),
  })
);

export const mysqlPackagingTolerancesRelations = relations(mysqlPackagingTolerances, ({ one }) => ({
  createdBy: one(mysqlUsers, {
    fields: [mysqlPackagingTolerances.createdByUserId],
    references: [mysqlUsers.id],
  }),
}));

// ============================================
// TypeScript Types
// ============================================

export type WoPackagingReturnDb = typeof sqliteWoPackagingReturns.$inferSelect;
export type NewWoPackagingReturnDb = typeof sqliteWoPackagingReturns.$inferInsert;

export type WoPackagingReturnApprovalDb = typeof sqliteWoPackagingReturnApprovals.$inferSelect;
export type NewWoPackagingReturnApprovalDb = typeof sqliteWoPackagingReturnApprovals.$inferInsert;

export type PackagingToleranceDb = typeof sqlitePackagingTolerances.$inferSelect;
export type NewPackagingToleranceDb = typeof sqlitePackagingTolerances.$inferInsert;
