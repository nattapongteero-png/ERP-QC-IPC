// Scale Pre-Use Verification Module Schema
// Feature: 021-scale-verification
//
// Tables:
//   - standard_weights        — certified test weights master
//   - scale_verifications     — per-use verification records
//
// Additive columns on existing tables (in schema.ts):
//   - production_equipment: verificationIntervalHours, minVerificationWeightG,
//                            maxVerificationWeightG, tolerancePercent, scaleStatus
//   - work_order_materials: scaleVerificationId (nullable FK)

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import {
  mysqlTable,
  varchar,
  int,
  decimal,
  datetime,
  date as mysqlDate,
  text as mysqlText,
  boolean as mysqlBoolean,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import {
  sqliteUsers,
  mysqlUsers,
  sqliteElectronicSignatures,
  mysqlElectronicSignatures,
  sqliteProductionEquipment,
  mysqlProductionEquipment,
} from './schema';

// ============================================
// SQLite
// ============================================

export const sqliteStandardWeights = sqliteTable('standard_weights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  denominationValue: real('denomination_value').notNull(),
  denominationUnit: text('denomination_unit').notNull(),
  accuracyClass: text('accuracy_class').notNull(),
  certificateNumber: text('certificate_number').notNull(),
  certificateIssuer: text('certificate_issuer').notNull(),
  certificateIssueDate: text('certificate_issue_date').notNull(),
  certificateExpiryDate: text('certificate_expiry_date').notNull(),
  ownerDepartment: text('owner_department'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdByUserId: integer('created_by_user_id').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteScaleVerifications = sqliteTable('scale_verifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scaleId: integer('scale_id')
    .notNull()
    .references(() => sqliteProductionEquipment.id),
  standardWeightId: integer('standard_weight_id')
    .notNull()
    .references(() => sqliteStandardWeights.id),
  certifiedValueSnapshot: real('certified_value_snapshot').notNull(),
  certifiedUnitSnapshot: text('certified_unit_snapshot').notNull(),
  actualReading: real('actual_reading').notNull(),
  deviationAmount: real('deviation_amount').notNull(),
  deviationPercent: real('deviation_percent').notNull(),
  result: text('result').notNull(), // 'pass' | 'fail'
  operatorUserId: integer('operator_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  signatureId: integer('signature_id').references(() => sqliteElectronicSignatures.id),
  performedAt: text('performed_at').notNull().default('CURRENT_TIMESTAMP'),
  validUntil: text('valid_until').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ---------- SQLite Relations ----------

export const sqliteStandardWeightsRelations = relations(sqliteStandardWeights, ({ one }) => ({
  createdBy: one(sqliteUsers, {
    fields: [sqliteStandardWeights.createdByUserId],
    references: [sqliteUsers.id],
  }),
}));

export const sqliteScaleVerificationsRelations = relations(
  sqliteScaleVerifications,
  ({ one }) => ({
    scale: one(sqliteProductionEquipment, {
      fields: [sqliteScaleVerifications.scaleId],
      references: [sqliteProductionEquipment.id],
    }),
    standardWeight: one(sqliteStandardWeights, {
      fields: [sqliteScaleVerifications.standardWeightId],
      references: [sqliteStandardWeights.id],
    }),
    operator: one(sqliteUsers, {
      fields: [sqliteScaleVerifications.operatorUserId],
      references: [sqliteUsers.id],
    }),
    signature: one(sqliteElectronicSignatures, {
      fields: [sqliteScaleVerifications.signatureId],
      references: [sqliteElectronicSignatures.id],
    }),
  }),
);

// ============================================
// MySQL
// ============================================

export const mysqlStandardWeights = mysqlTable('standard_weights', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  denominationValue: decimal('denomination_value', { precision: 15, scale: 4 }).notNull(),
  denominationUnit: varchar('denomination_unit', { length: 10 }).notNull(),
  accuracyClass: varchar('accuracy_class', { length: 5 }).notNull(),
  certificateNumber: varchar('certificate_number', { length: 100 }).notNull(),
  certificateIssuer: varchar('certificate_issuer', { length: 200 }).notNull(),
  certificateIssueDate: mysqlDate('certificate_issue_date').notNull(),
  certificateExpiryDate: mysqlDate('certificate_expiry_date').notNull(),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  notes: mysqlText('notes'),
  createdByUserId: int('created_by_user_id').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlScaleVerifications = mysqlTable('scale_verifications', {
  id: int('id').primaryKey().autoincrement(),
  scaleId: int('scale_id')
    .notNull()
    .references(() => mysqlProductionEquipment.id),
  standardWeightId: int('standard_weight_id')
    .notNull()
    .references(() => mysqlStandardWeights.id),
  certifiedValueSnapshot: decimal('certified_value_snapshot', { precision: 15, scale: 4 }).notNull(),
  certifiedUnitSnapshot: varchar('certified_unit_snapshot', { length: 10 }).notNull(),
  actualReading: decimal('actual_reading', { precision: 15, scale: 4 }).notNull(),
  deviationAmount: decimal('deviation_amount', { precision: 15, scale: 4 }).notNull(),
  deviationPercent: decimal('deviation_percent', { precision: 8, scale: 4 }).notNull(),
  result: varchar('result', { length: 10 }).notNull(),
  operatorUserId: int('operator_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  signatureId: int('signature_id').references(() => mysqlElectronicSignatures.id),
  performedAt: datetime('performed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  validUntil: datetime('valid_until').notNull(),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- MySQL Relations ----------

export const mysqlStandardWeightsRelations = relations(mysqlStandardWeights, ({ one }) => ({
  createdBy: one(mysqlUsers, {
    fields: [mysqlStandardWeights.createdByUserId],
    references: [mysqlUsers.id],
  }),
}));

export const mysqlScaleVerificationsRelations = relations(mysqlScaleVerifications, ({ one }) => ({
  scale: one(mysqlProductionEquipment, {
    fields: [mysqlScaleVerifications.scaleId],
    references: [mysqlProductionEquipment.id],
  }),
  standardWeight: one(mysqlStandardWeights, {
    fields: [mysqlScaleVerifications.standardWeightId],
    references: [mysqlStandardWeights.id],
  }),
  operator: one(mysqlUsers, {
    fields: [mysqlScaleVerifications.operatorUserId],
    references: [mysqlUsers.id],
  }),
  signature: one(mysqlElectronicSignatures, {
    fields: [mysqlScaleVerifications.signatureId],
    references: [mysqlElectronicSignatures.id],
  }),
}));

// ============================================
// TS types
// ============================================

export type StandardWeightDb = typeof sqliteStandardWeights.$inferSelect;
export type NewStandardWeightDb = typeof sqliteStandardWeights.$inferInsert;
export type ScaleVerificationDb = typeof sqliteScaleVerifications.$inferSelect;
export type NewScaleVerificationDb = typeof sqliteScaleVerifications.$inferInsert;
