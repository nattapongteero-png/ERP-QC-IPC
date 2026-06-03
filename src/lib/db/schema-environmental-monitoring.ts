// Environmental Monitoring & Water Quality Module
// Feature: 023-environmental-monitoring

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import {
  mysqlTable,
  varchar,
  int,
  decimal,
  datetime,
  date as mysqlDate,
  text as mysqlText,
  json as mysqlJson,
  boolean as mysqlBoolean,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import {
  sqliteUsers,
  mysqlUsers,
  sqliteElectronicSignatures,
  mysqlElectronicSignatures,
  sqliteDeviations,
  mysqlDeviations,
} from './schema';

// ============================================
// SQLite
// ============================================

export const sqliteInspectionTemplates = sqliteTable('env_inspection_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  targetType: text('target_type').notNull(), // room | storage_area | quarantine | water_point
  itemsJson: text('items_json').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: integer('created_by_user_id').references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteInspectionSchedules = sqliteTable('env_inspection_schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  targetName: text('target_name').notNull(),
  templateId: integer('template_id')
    .notNull()
    .references(() => sqliteInspectionTemplates.id),
  frequency: text('frequency').notNull(), // daily | weekly | monthly | quarterly | yearly
  nextDue: text('next_due').notNull(),
  lastDone: text('last_done'),
  alertDaysBefore: integer('alert_days_before').notNull().default(1),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteInspectionRecords = sqliteTable('env_inspection_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  scheduleId: integer('schedule_id').references(() => sqliteInspectionSchedules.id),
  templateId: integer('template_id')
    .notNull()
    .references(() => sqliteInspectionTemplates.id),
  templateVersion: integer('template_version').notNull().default(1),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id').notNull(),
  performedAt: text('performed_at').notNull().default('CURRENT_TIMESTAMP'),
  operatorUserId: integer('operator_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  signatureId: integer('signature_id').references(() => sqliteElectronicSignatures.id),
  status: text('status').notNull().default('completed'),
  overallResult: text('overall_result').notNull().default('in_spec'), // in_spec | out_of_spec | na
  notes: text('notes'),
  deviationId: integer('deviation_id').references(() => sqliteDeviations.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteInspectionResults = sqliteTable('env_inspection_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  inspectionId: integer('inspection_id')
    .notNull()
    .references(() => sqliteInspectionRecords.id, { onDelete: 'cascade' }),
  templateItemId: integer('template_item_id').notNull(),
  parameter: text('parameter').notNull(),
  numericValue: real('numeric_value'),
  textValue: text('text_value'),
  specMinSnapshot: real('spec_min_snapshot'),
  specMaxSnapshot: real('spec_max_snapshot'),
  result: text('result').notNull().default('in_spec'),
  remarks: text('remarks'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Water systems

export const sqliteWaterSystems = sqliteTable('water_systems', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  systemType: text('system_type').notNull(), // tap | ro | purified | wfi | usp_purified | other
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteWaterSamplePoints = sqliteTable('water_sample_points', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterSystemId: integer('water_system_id')
    .notNull()
    .references(() => sqliteWaterSystems.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  location: text('location'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteWaterQualitySpecs = sqliteTable('water_quality_specs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  waterSystemId: integer('water_system_id')
    .notNull()
    .references(() => sqliteWaterSystems.id),
  samplePointId: integer('sample_point_id').references(() => sqliteWaterSamplePoints.id),
  parameter: text('parameter').notNull(), // ph | conductivity | toc | microbial_count
  unit: text('unit').notNull(),
  specMin: real('spec_min'),
  specMax: real('spec_max'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteWaterQualityTests = sqliteTable('water_quality_tests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  samplePointId: integer('sample_point_id')
    .notNull()
    .references(() => sqliteWaterSamplePoints.id),
  waterSystemId: integer('water_system_id')
    .notNull()
    .references(() => sqliteWaterSystems.id),
  performedAt: text('performed_at').notNull().default('CURRENT_TIMESTAMP'),
  operatorUserId: integer('operator_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  signatureId: integer('signature_id').references(() => sqliteElectronicSignatures.id),
  overallResult: text('overall_result').notNull().default('in_spec'),
  notes: text('notes'),
  deviationId: integer('deviation_id').references(() => sqliteDeviations.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteWaterQualityTestResults = sqliteTable('water_quality_test_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id')
    .notNull()
    .references(() => sqliteWaterQualityTests.id, { onDelete: 'cascade' }),
  specId: integer('spec_id').references(() => sqliteWaterQualitySpecs.id),
  parameter: text('parameter').notNull(),
  numericValue: real('numeric_value'),
  unit: text('unit').notNull(),
  specMinSnapshot: real('spec_min_snapshot'),
  specMaxSnapshot: real('spec_max_snapshot'),
  result: text('result').notNull().default('in_spec'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// MySQL
// ============================================

export const mysqlInspectionTemplates = mysqlTable('env_inspection_templates', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: mysqlText('description'),
  targetType: varchar('target_type', { length: 30 }).notNull(),
  itemsJson: mysqlJson('items_json').notNull(),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdByUserId: int('created_by_user_id').references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlInspectionSchedules = mysqlTable('env_inspection_schedules', {
  id: int('id').primaryKey().autoincrement(),
  targetType: varchar('target_type', { length: 30 }).notNull(),
  targetId: int('target_id').notNull(),
  targetName: varchar('target_name', { length: 100 }).notNull(),
  templateId: int('template_id')
    .notNull()
    .references(() => mysqlInspectionTemplates.id),
  frequency: varchar('frequency', { length: 20 }).notNull(),
  nextDue: datetime('next_due').notNull(),
  lastDone: datetime('last_done'),
  alertDaysBefore: int('alert_days_before').notNull().default(1),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlInspectionRecords = mysqlTable('env_inspection_records', {
  id: int('id').primaryKey().autoincrement(),
  scheduleId: int('schedule_id').references(() => mysqlInspectionSchedules.id),
  templateId: int('template_id')
    .notNull()
    .references(() => mysqlInspectionTemplates.id),
  templateVersion: int('template_version').notNull().default(1),
  targetType: varchar('target_type', { length: 30 }).notNull(),
  targetId: int('target_id').notNull(),
  performedAt: datetime('performed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  operatorUserId: int('operator_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  signatureId: int('signature_id').references(() => mysqlElectronicSignatures.id),
  status: varchar('status', { length: 20 }).notNull().default('completed'),
  overallResult: varchar('overall_result', { length: 20 }).notNull().default('in_spec'),
  notes: mysqlText('notes'),
  deviationId: int('deviation_id').references(() => mysqlDeviations.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlInspectionResults = mysqlTable('env_inspection_results', {
  id: int('id').primaryKey().autoincrement(),
  inspectionId: int('inspection_id')
    .notNull()
    .references(() => mysqlInspectionRecords.id, { onDelete: 'cascade' }),
  templateItemId: int('template_item_id').notNull(),
  parameter: varchar('parameter', { length: 50 }).notNull(),
  numericValue: decimal('numeric_value', { precision: 15, scale: 4 }),
  textValue: varchar('text_value', { length: 500 }),
  specMinSnapshot: decimal('spec_min_snapshot', { precision: 15, scale: 4 }),
  specMaxSnapshot: decimal('spec_max_snapshot', { precision: 15, scale: 4 }),
  result: varchar('result', { length: 20 }).notNull().default('in_spec'),
  remarks: mysqlText('remarks'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWaterSystems = mysqlTable('water_systems', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  systemType: varchar('system_type', { length: 30 }).notNull(),
  description: mysqlText('description'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWaterSamplePoints = mysqlTable('water_sample_points', {
  id: int('id').primaryKey().autoincrement(),
  waterSystemId: int('water_system_id')
    .notNull()
    .references(() => mysqlWaterSystems.id),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  location: varchar('location', { length: 200 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWaterQualitySpecs = mysqlTable('water_quality_specs', {
  id: int('id').primaryKey().autoincrement(),
  waterSystemId: int('water_system_id')
    .notNull()
    .references(() => mysqlWaterSystems.id),
  samplePointId: int('sample_point_id').references(() => mysqlWaterSamplePoints.id),
  parameter: varchar('parameter', { length: 30 }).notNull(),
  unit: varchar('unit', { length: 20 }).notNull(),
  specMin: decimal('spec_min', { precision: 15, scale: 4 }),
  specMax: decimal('spec_max', { precision: 15, scale: 4 }),
  notes: mysqlText('notes'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWaterQualityTests = mysqlTable('water_quality_tests', {
  id: int('id').primaryKey().autoincrement(),
  samplePointId: int('sample_point_id')
    .notNull()
    .references(() => mysqlWaterSamplePoints.id),
  waterSystemId: int('water_system_id')
    .notNull()
    .references(() => mysqlWaterSystems.id),
  performedAt: datetime('performed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  operatorUserId: int('operator_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  signatureId: int('signature_id').references(() => mysqlElectronicSignatures.id),
  overallResult: varchar('overall_result', { length: 20 }).notNull().default('in_spec'),
  notes: mysqlText('notes'),
  deviationId: int('deviation_id').references(() => mysqlDeviations.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlWaterQualityTestResults = mysqlTable('water_quality_test_results', {
  id: int('id').primaryKey().autoincrement(),
  testId: int('test_id')
    .notNull()
    .references(() => mysqlWaterQualityTests.id, { onDelete: 'cascade' }),
  specId: int('spec_id').references(() => mysqlWaterQualitySpecs.id),
  parameter: varchar('parameter', { length: 30 }).notNull(),
  numericValue: decimal('numeric_value', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 20 }).notNull(),
  specMinSnapshot: decimal('spec_min_snapshot', { precision: 15, scale: 4 }),
  specMaxSnapshot: decimal('spec_max_snapshot', { precision: 15, scale: 4 }),
  result: varchar('result', { length: 20 }).notNull().default('in_spec'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================
// Relations (SQLite + MySQL minimal)
// ============================================

export const sqliteInspectionRecordsRelations = relations(
  sqliteInspectionRecords,
  ({ one, many }) => ({
    template: one(sqliteInspectionTemplates, {
      fields: [sqliteInspectionRecords.templateId],
      references: [sqliteInspectionTemplates.id],
    }),
    operator: one(sqliteUsers, {
      fields: [sqliteInspectionRecords.operatorUserId],
      references: [sqliteUsers.id],
    }),
    results: many(sqliteInspectionResults),
  }),
);

export const sqliteWaterQualityTestsRelations = relations(
  sqliteWaterQualityTests,
  ({ one, many }) => ({
    waterSystem: one(sqliteWaterSystems, {
      fields: [sqliteWaterQualityTests.waterSystemId],
      references: [sqliteWaterSystems.id],
    }),
    samplePoint: one(sqliteWaterSamplePoints, {
      fields: [sqliteWaterQualityTests.samplePointId],
      references: [sqliteWaterSamplePoints.id],
    }),
    operator: one(sqliteUsers, {
      fields: [sqliteWaterQualityTests.operatorUserId],
      references: [sqliteUsers.id],
    }),
    results: many(sqliteWaterQualityTestResults),
  }),
);

export const mysqlInspectionRecordsRelations = relations(
  mysqlInspectionRecords,
  ({ one, many }) => ({
    template: one(mysqlInspectionTemplates, {
      fields: [mysqlInspectionRecords.templateId],
      references: [mysqlInspectionTemplates.id],
    }),
    operator: one(mysqlUsers, {
      fields: [mysqlInspectionRecords.operatorUserId],
      references: [mysqlUsers.id],
    }),
    results: many(mysqlInspectionResults),
  }),
);

export const mysqlWaterQualityTestsRelations = relations(
  mysqlWaterQualityTests,
  ({ one, many }) => ({
    waterSystem: one(mysqlWaterSystems, {
      fields: [mysqlWaterQualityTests.waterSystemId],
      references: [mysqlWaterSystems.id],
    }),
    samplePoint: one(mysqlWaterSamplePoints, {
      fields: [mysqlWaterQualityTests.samplePointId],
      references: [mysqlWaterSamplePoints.id],
    }),
    operator: one(mysqlUsers, {
      fields: [mysqlWaterQualityTests.operatorUserId],
      references: [mysqlUsers.id],
    }),
    results: many(mysqlWaterQualityTestResults),
  }),
);

// ============================================
// Types
// ============================================

export type InspectionTemplateDb = typeof sqliteInspectionTemplates.$inferSelect;
export type NewInspectionTemplateDb = typeof sqliteInspectionTemplates.$inferInsert;
export type InspectionScheduleDb = typeof sqliteInspectionSchedules.$inferSelect;
export type NewInspectionScheduleDb = typeof sqliteInspectionSchedules.$inferInsert;
export type InspectionRecordDb = typeof sqliteInspectionRecords.$inferSelect;
export type NewInspectionRecordDb = typeof sqliteInspectionRecords.$inferInsert;
export type InspectionResultDb = typeof sqliteInspectionResults.$inferSelect;
export type WaterSystemDb = typeof sqliteWaterSystems.$inferSelect;
export type NewWaterSystemDb = typeof sqliteWaterSystems.$inferInsert;
export type WaterSamplePointDb = typeof sqliteWaterSamplePoints.$inferSelect;
export type WaterQualitySpecDb = typeof sqliteWaterQualitySpecs.$inferSelect;
export type WaterQualityTestDb = typeof sqliteWaterQualityTests.$inferSelect;
export type WaterQualityTestResultDb = typeof sqliteWaterQualityTestResults.$inferSelect;
