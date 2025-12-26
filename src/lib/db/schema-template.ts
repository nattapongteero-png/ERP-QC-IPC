// Template Module Schema
// This is a prototype schema for creating new ERP modules
// Feature: Template Module for prototyping

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { mysqlTable, varchar, int, decimal, datetime, date, time, boolean as mysqlBoolean, text as mysqlText } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { sqliteUsers, mysqlUsers } from './schema';

// ============================================
// SQLite Schema (for unit testing)
// ============================================

// Template Categories
export const sqliteTemplateCategories = sqliteTable('template_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  color: text('color').notNull().default('#3B82F6'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Template Items
export const sqliteTemplateItems = sqliteTable('template_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  nameTh: text('name_th').notNull(),
  nameEn: text('name_en'),
  description: text('description'),
  status: text('status').notNull().default('draft'), // draft, active, archived
  priority: text('priority').notNull().default('medium'), // low, medium, high, urgent
  categoryId: integer('category_id').references(() => sqliteTemplateCategories.id),
  quantity: real('quantity').notNull().default(0),
  unitPrice: real('unit_price').notNull().default(0),
  totalValue: real('total_value').notNull().default(0), // Computed: quantity * unitPrice
  dueDate: text('due_date'), // Date in YYYY-MM-DD format
  dueTime: text('due_time'), // Time in HH:mm format
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
  createdBy: integer('created_by').references(() => sqliteUsers.id),
  updatedBy: integer('updated_by').references(() => sqliteUsers.id),
});

// SQLite Relations
export const sqliteTemplateCategoriesRelations = relations(sqliteTemplateCategories, ({ many }) => ({
  items: many(sqliteTemplateItems),
}));

export const sqliteTemplateItemsRelations = relations(sqliteTemplateItems, ({ one }) => ({
  category: one(sqliteTemplateCategories, {
    fields: [sqliteTemplateItems.categoryId],
    references: [sqliteTemplateCategories.id],
  }),
  createdByUser: one(sqliteUsers, {
    fields: [sqliteTemplateItems.createdBy],
    references: [sqliteUsers.id],
  }),
  updatedByUser: one(sqliteUsers, {
    fields: [sqliteTemplateItems.updatedBy],
    references: [sqliteUsers.id],
  }),
}));

// ============================================
// MySQL Schema (for production)
// ============================================

// Template Categories
export const mysqlTemplateCategories = mysqlTable('template_categories', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  description: varchar('description', { length: 500 }),
  color: varchar('color', { length: 7 }).notNull().default('#3B82F6'),
  sortOrder: int('sort_order').notNull().default(0),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Template Items
export const mysqlTemplateItems = mysqlTable('template_items', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  nameTh: varchar('name_th', { length: 200 }).notNull(),
  nameEn: varchar('name_en', { length: 200 }),
  description: mysqlText('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, active, archived
  priority: varchar('priority', { length: 20 }).notNull().default('medium'), // low, medium, high, urgent
  categoryId: int('category_id').references(() => mysqlTemplateCategories.id),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).notNull().default('0'),
  unitPrice: decimal('unit_price', { precision: 18, scale: 4 }).notNull().default('0'),
  totalValue: decimal('total_value', { precision: 18, scale: 4 }).notNull().default('0'),
  dueDate: date('due_date'), // Date field
  dueTime: time('due_time'), // Time field
  notes: mysqlText('notes'),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
  createdBy: int('created_by').references(() => mysqlUsers.id),
  updatedBy: int('updated_by').references(() => mysqlUsers.id),
});

// MySQL Relations
export const mysqlTemplateCategoriesRelations = relations(mysqlTemplateCategories, ({ many }) => ({
  items: many(mysqlTemplateItems),
}));

export const mysqlTemplateItemsRelations = relations(mysqlTemplateItems, ({ one }) => ({
  category: one(mysqlTemplateCategories, {
    fields: [mysqlTemplateItems.categoryId],
    references: [mysqlTemplateCategories.id],
  }),
  createdByUser: one(mysqlUsers, {
    fields: [mysqlTemplateItems.createdBy],
    references: [mysqlUsers.id],
  }),
  updatedByUser: one(mysqlUsers, {
    fields: [mysqlTemplateItems.updatedBy],
    references: [mysqlUsers.id],
  }),
}));

// ============================================
// Type Exports (inferred from SQLite schema)
// ============================================

export type TemplateCategory = typeof sqliteTemplateCategories.$inferSelect;
export type NewTemplateCategory = typeof sqliteTemplateCategories.$inferInsert;
export type TemplateItem = typeof sqliteTemplateItems.$inferSelect;
export type NewTemplateItem = typeof sqliteTemplateItems.$inferInsert;
