// Equipment Maintenance Notifications Module Schema
// Feature: 022-equipment-notifications

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import {
  mysqlTable,
  varchar,
  int,
  datetime,
  text as mysqlText,
  boolean as mysqlBoolean,
} from 'drizzle-orm/mysql-core';
import { relations, sql } from 'drizzle-orm';
import {
  sqliteUsers,
  mysqlUsers,
} from './schema';

// ============================================
// SQLite
// ============================================

export const sqliteEquipmentNotifications = sqliteTable('equipment_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entityType: text('entity_type').notNull(), // 'equipment' | 'accounting_equipment' | 'production_equipment' | 'scale'
  entityId: integer('entity_id').notNull(),
  scheduleId: integer('schedule_id'), // FK to acct_maintenance_schedules.id when applicable
  type: text('type').notNull(), // maintenance_due | calibration_due | scale_failure | verification_expired | inspection_due
  severity: text('severity').notNull(), // overdue | due_today | due_in_7d | due_in_30d | info
  title: text('title').notNull(),
  body: text('body'),
  dueAt: text('due_at'),
  status: text('status').notNull().default('open'), // open | acknowledged | snoozed | dismissed | resolved
  recipientUserId: integer('recipient_user_id').references(() => sqliteUsers.id),
  recipientRole: text('recipient_role'),
  acknowledgedAt: text('acknowledged_at'),
  acknowledgedByUserId: integer('acknowledged_by_user_id').references(() => sqliteUsers.id),
  acknowledgeNote: text('acknowledge_note'),
  snoozedUntil: text('snoozed_until'),
  resolvedAt: text('resolved_at'),
  // Idempotency key (entityType|entityId|scheduleId|dueDateOnly) — see service
  dedupeKey: text('dedupe_key').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteMaintenancePlanTemplates = sqliteTable('maintenance_plan_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  maintenanceType: text('maintenance_type').notNull(),
  intervalType: text('interval_type').notNull(), // days | weeks | months | hours | units
  intervalValue: integer('interval_value').notNull(),
  alertDaysBefore: integer('alert_days_before').notNull().default(7),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdByUserId: integer('created_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ---------- SQLite Relations ----------

export const sqliteEquipmentNotificationsRelations = relations(
  sqliteEquipmentNotifications,
  ({ one }) => ({
    recipient: one(sqliteUsers, {
      fields: [sqliteEquipmentNotifications.recipientUserId],
      references: [sqliteUsers.id],
    }),
    acknowledgedBy: one(sqliteUsers, {
      fields: [sqliteEquipmentNotifications.acknowledgedByUserId],
      references: [sqliteUsers.id],
    }),
  }),
);

export const sqliteMaintenancePlanTemplatesRelations = relations(
  sqliteMaintenancePlanTemplates,
  ({ one }) => ({
    createdBy: one(sqliteUsers, {
      fields: [sqliteMaintenancePlanTemplates.createdByUserId],
      references: [sqliteUsers.id],
    }),
  }),
);

// ============================================
// MySQL
// ============================================

export const mysqlEquipmentNotifications = mysqlTable('equipment_notifications', {
  id: int('id').primaryKey().autoincrement(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: int('entity_id').notNull(),
  scheduleId: int('schedule_id'),
  type: varchar('type', { length: 50 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: mysqlText('body'),
  dueAt: datetime('due_at'),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  recipientUserId: int('recipient_user_id').references(() => mysqlUsers.id),
  recipientRole: varchar('recipient_role', { length: 50 }),
  acknowledgedAt: datetime('acknowledged_at'),
  acknowledgedByUserId: int('acknowledged_by_user_id').references(() => mysqlUsers.id),
  acknowledgeNote: mysqlText('acknowledge_note'),
  snoozedUntil: datetime('snoozed_until'),
  resolvedAt: datetime('resolved_at'),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlMaintenancePlanTemplates = mysqlTable('maintenance_plan_templates', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: mysqlText('description'),
  maintenanceType: varchar('maintenance_type', { length: 50 }).notNull(),
  intervalType: varchar('interval_type', { length: 20 }).notNull(),
  intervalValue: int('interval_value').notNull(),
  alertDaysBefore: int('alert_days_before').notNull().default(7),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdByUserId: int('created_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- MySQL Relations ----------

export const mysqlEquipmentNotificationsRelations = relations(
  mysqlEquipmentNotifications,
  ({ one }) => ({
    recipient: one(mysqlUsers, {
      fields: [mysqlEquipmentNotifications.recipientUserId],
      references: [mysqlUsers.id],
    }),
    acknowledgedBy: one(mysqlUsers, {
      fields: [mysqlEquipmentNotifications.acknowledgedByUserId],
      references: [mysqlUsers.id],
    }),
  }),
);

export const mysqlMaintenancePlanTemplatesRelations = relations(
  mysqlMaintenancePlanTemplates,
  ({ one }) => ({
    createdBy: one(mysqlUsers, {
      fields: [mysqlMaintenancePlanTemplates.createdByUserId],
      references: [mysqlUsers.id],
    }),
  }),
);

// ============================================
// TS types
// ============================================

export type EquipmentNotificationDb = typeof sqliteEquipmentNotifications.$inferSelect;
export type NewEquipmentNotificationDb = typeof sqliteEquipmentNotifications.$inferInsert;
export type MaintenancePlanTemplateDb = typeof sqliteMaintenancePlanTemplates.$inferSelect;
export type NewMaintenancePlanTemplateDb = typeof sqliteMaintenancePlanTemplates.$inferInsert;
