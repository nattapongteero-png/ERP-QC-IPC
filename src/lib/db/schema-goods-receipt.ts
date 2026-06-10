// Goods Receipt & Incoming Inspection Module Schema
// Feature: 020-goods-receipt
//
// Tables:
//   - goods_receipts                   — GRN header
//   - goods_receipt_lines              — per-item line
//   - goods_receipt_checklists         — signed checklist snapshot per line
//   - receipt_checklist_templates      — admin-versioned templates
//   - receipt_tolerances               — per-category tolerance config
//   - goods_receipt_sequences          — per-year counter for GRN numbering

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
  sqliteInventoryLots,
  mysqlInventoryLots,
  sqliteQcSamples,
  mysqlQcSamples,
  sqlitePurchaseOrders,
  mysqlPurchaseOrders,
  sqliteWorkOrders,
  mysqlWorkOrders,
  sqliteVendors,
  mysqlVendors,
  sqliteWarehouses,
  mysqlWarehouses,
  sqliteItems,
  mysqlItems,
  sqlitePurchaseOrderLines,
  mysqlPurchaseOrderLines,
} from './schema';

// ============================================
// SQLite Schema
// ============================================

export const sqliteGoodsReceipts = sqliteTable('goods_receipts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grnNumber: text('grn_number').notNull().unique(),
  sourceType: text('source_type').notNull(), // 'po' | 'wo'
  poId: integer('po_id').references(() => sqlitePurchaseOrders.id),
  woId: integer('wo_id').references(() => sqliteWorkOrders.id),
  vendorId: integer('vendor_id').references(() => sqliteVendors.id),
  warehouseId: integer('warehouse_id')
    .notNull()
    .references(() => sqliteWarehouses.id),
  status: text('status').notNull().default('in_progress'),
  receiverUserId: integer('receiver_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  receivedDate: text('received_date').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteGoodsReceiptLines = sqliteTable('goods_receipt_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  grnId: integer('grn_id')
    .notNull()
    .references(() => sqliteGoodsReceipts.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  itemId: integer('item_id')
    .notNull()
    .references(() => sqliteItems.id),
  expectedQuantity: real('expected_quantity').notNull(),
  actualQuantity: real('actual_quantity'),
  // Qty QC drew as a sample into the QC warehouse (set at checklist sign).
  sampleQuantity: real('sample_quantity'),
  unit: text('unit').notNull(),
  vendorLotNumber: text('vendor_lot_number'),
  batchNumber: text('batch_number'),
  manufacturingDate: text('manufacturing_date'),
  expiryDate: text('expiry_date'),
  varianceAmount: real('variance_amount'),
  variancePercent: real('variance_percent'),
  varianceReason: text('variance_reason'),
  status: text('status').notNull().default('created'),
  inventoryLotId: integer('inventory_lot_id').references(() => sqliteInventoryLots.id),
  // Lot holding the QC sample in the QC warehouse (set at checklist sign).
  qcLotId: integer('qc_lot_id').references(() => sqliteInventoryLots.id),
  qcSampleId: integer('qc_sample_id').references(() => sqliteQcSamples.id),
  qcSampleCreationFailed: integer('qc_sample_creation_failed', { mode: 'boolean' })
    .notNull()
    .default(false),
  receiverSignatureId: integer('receiver_signature_id').references(
    () => sqliteElectronicSignatures.id,
  ),
  qaSignatureId: integer('qa_signature_id').references(() => sqliteElectronicSignatures.id),
  qaDecisionAt: text('qa_decision_at'),
  rejectionReason: text('rejection_reason'),
  sourcePoLineId: integer('source_po_line_id').references(() => sqlitePurchaseOrderLines.id),
  sourceWoOutputId: integer('source_wo_output_id'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteGoodsReceiptChecklists = sqliteTable('goods_receipt_checklists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  lineId: integer('line_id')
    .notNull()
    .unique()
    .references(() => sqliteGoodsReceiptLines.id, { onDelete: 'cascade' }),
  templateId: integer('template_id').notNull(),
  templateVersion: integer('template_version').notNull(),
  category: text('category').notNull(),
  capturedItemsJson: text('captured_items_json').notNull(),
  signedAt: text('signed_at').notNull().default('CURRENT_TIMESTAMP'),
  signatureId: integer('signature_id')
    .notNull()
    .references(() => sqliteElectronicSignatures.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteReceiptChecklistTemplates = sqliteTable('receipt_checklist_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(), // 'raw_material' | 'finished_goods'
  version: integer('version').notNull(),
  isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
  itemsJson: text('items_json').notNull(),
  createdByUserId: integer('created_by_user_id')
    .notNull()
    .references(() => sqliteUsers.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteReceiptTolerances = sqliteTable('receipt_tolerances', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull().unique(),
  tolerancePercent: real('tolerance_percent').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const sqliteGoodsReceiptSequences = sqliteTable('goods_receipt_sequences', {
  year: integer('year').primaryKey(),
  nextValue: integer('next_value').notNull().default(1),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ---------- SQLite Relations ----------

export const sqliteGoodsReceiptsRelations = relations(sqliteGoodsReceipts, ({ one, many }) => ({
  po: one(sqlitePurchaseOrders, {
    fields: [sqliteGoodsReceipts.poId],
    references: [sqlitePurchaseOrders.id],
  }),
  wo: one(sqliteWorkOrders, {
    fields: [sqliteGoodsReceipts.woId],
    references: [sqliteWorkOrders.id],
  }),
  vendor: one(sqliteVendors, {
    fields: [sqliteGoodsReceipts.vendorId],
    references: [sqliteVendors.id],
  }),
  warehouse: one(sqliteWarehouses, {
    fields: [sqliteGoodsReceipts.warehouseId],
    references: [sqliteWarehouses.id],
  }),
  receiver: one(sqliteUsers, {
    fields: [sqliteGoodsReceipts.receiverUserId],
    references: [sqliteUsers.id],
  }),
  lines: many(sqliteGoodsReceiptLines),
}));

export const sqliteGoodsReceiptLinesRelations = relations(
  sqliteGoodsReceiptLines,
  ({ one }) => ({
    grn: one(sqliteGoodsReceipts, {
      fields: [sqliteGoodsReceiptLines.grnId],
      references: [sqliteGoodsReceipts.id],
    }),
    item: one(sqliteItems, {
      fields: [sqliteGoodsReceiptLines.itemId],
      references: [sqliteItems.id],
    }),
    inventoryLot: one(sqliteInventoryLots, {
      fields: [sqliteGoodsReceiptLines.inventoryLotId],
      references: [sqliteInventoryLots.id],
    }),
    qcSample: one(sqliteQcSamples, {
      fields: [sqliteGoodsReceiptLines.qcSampleId],
      references: [sqliteQcSamples.id],
    }),
    checklist: one(sqliteGoodsReceiptChecklists, {
      fields: [sqliteGoodsReceiptLines.id],
      references: [sqliteGoodsReceiptChecklists.lineId],
    }),
    receiverSignature: one(sqliteElectronicSignatures, {
      fields: [sqliteGoodsReceiptLines.receiverSignatureId],
      references: [sqliteElectronicSignatures.id],
    }),
    qaSignature: one(sqliteElectronicSignatures, {
      fields: [sqliteGoodsReceiptLines.qaSignatureId],
      references: [sqliteElectronicSignatures.id],
    }),
  }),
);

export const sqliteGoodsReceiptChecklistsRelations = relations(
  sqliteGoodsReceiptChecklists,
  ({ one }) => ({
    line: one(sqliteGoodsReceiptLines, {
      fields: [sqliteGoodsReceiptChecklists.lineId],
      references: [sqliteGoodsReceiptLines.id],
    }),
    signature: one(sqliteElectronicSignatures, {
      fields: [sqliteGoodsReceiptChecklists.signatureId],
      references: [sqliteElectronicSignatures.id],
    }),
  }),
);

// ============================================
// MySQL Schema
// ============================================

export const mysqlGoodsReceipts = mysqlTable('goods_receipts', {
  id: int('id').primaryKey().autoincrement(),
  grnNumber: varchar('grn_number', { length: 20 }).notNull().unique(),
  sourceType: varchar('source_type', { length: 2 }).notNull(),
  poId: int('po_id').references(() => mysqlPurchaseOrders.id),
  woId: int('wo_id').references(() => mysqlWorkOrders.id),
  vendorId: int('vendor_id').references(() => mysqlVendors.id),
  warehouseId: int('warehouse_id')
    .notNull()
    .references(() => mysqlWarehouses.id),
  status: varchar('status', { length: 20 }).notNull().default('in_progress'),
  receiverUserId: int('receiver_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  receivedDate: mysqlDate('received_date').notNull(),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlGoodsReceiptLines = mysqlTable('goods_receipt_lines', {
  id: int('id').primaryKey().autoincrement(),
  grnId: int('grn_id')
    .notNull()
    .references(() => mysqlGoodsReceipts.id, { onDelete: 'cascade' }),
  lineNumber: int('line_number').notNull(),
  itemId: int('item_id')
    .notNull()
    .references(() => mysqlItems.id),
  expectedQuantity: decimal('expected_quantity', { precision: 15, scale: 4 }).notNull(),
  actualQuantity: decimal('actual_quantity', { precision: 15, scale: 4 }),
  // Qty QC drew as a sample into the QC warehouse (set at checklist sign).
  sampleQuantity: decimal('sample_quantity', { precision: 15, scale: 4 }),
  unit: varchar('unit', { length: 20 }).notNull(),
  vendorLotNumber: varchar('vendor_lot_number', { length: 50 }),
  batchNumber: varchar('batch_number', { length: 50 }),
  manufacturingDate: mysqlDate('manufacturing_date'),
  expiryDate: mysqlDate('expiry_date'),
  varianceAmount: decimal('variance_amount', { precision: 15, scale: 4 }),
  variancePercent: decimal('variance_percent', { precision: 6, scale: 2 }),
  varianceReason: mysqlText('variance_reason'),
  status: varchar('status', { length: 30 }).notNull().default('created'),
  inventoryLotId: int('inventory_lot_id').references(() => mysqlInventoryLots.id),
  // Lot holding the QC sample in the QC warehouse (set at checklist sign).
  qcLotId: int('qc_lot_id').references(() => mysqlInventoryLots.id),
  qcSampleId: int('qc_sample_id').references(() => mysqlQcSamples.id),
  qcSampleCreationFailed: mysqlBoolean('qc_sample_creation_failed').notNull().default(false),
  receiverSignatureId: int('receiver_signature_id').references(
    () => mysqlElectronicSignatures.id,
  ),
  qaSignatureId: int('qa_signature_id').references(() => mysqlElectronicSignatures.id),
  qaDecisionAt: datetime('qa_decision_at'),
  rejectionReason: mysqlText('rejection_reason'),
  sourcePoLineId: int('source_po_line_id').references(() => mysqlPurchaseOrderLines.id),
  sourceWoOutputId: int('source_wo_output_id'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlGoodsReceiptChecklists = mysqlTable('goods_receipt_checklists', {
  id: int('id').primaryKey().autoincrement(),
  lineId: int('line_id')
    .notNull()
    .unique()
    .references(() => mysqlGoodsReceiptLines.id, { onDelete: 'cascade' }),
  templateId: int('template_id').notNull(),
  templateVersion: int('template_version').notNull(),
  category: varchar('category', { length: 20 }).notNull(),
  capturedItemsJson: mysqlJson('captured_items_json').notNull(),
  signedAt: datetime('signed_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  signatureId: int('signature_id')
    .notNull()
    .references(() => mysqlElectronicSignatures.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlReceiptChecklistTemplates = mysqlTable('receipt_checklist_templates', {
  id: int('id').primaryKey().autoincrement(),
  category: varchar('category', { length: 20 }).notNull(),
  version: int('version').notNull(),
  isCurrent: mysqlBoolean('is_current').notNull().default(true),
  itemsJson: mysqlJson('items_json').notNull(),
  createdByUserId: int('created_by_user_id')
    .notNull()
    .references(() => mysqlUsers.id),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlReceiptTolerances = mysqlTable('receipt_tolerances', {
  id: int('id').primaryKey().autoincrement(),
  category: varchar('category', { length: 20 }).notNull().unique(),
  tolerancePercent: decimal('tolerance_percent', { precision: 6, scale: 2 }).notNull(),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mysqlGoodsReceiptSequences = mysqlTable('goods_receipt_sequences', {
  year: int('year').primaryKey(),
  nextValue: int('next_value').notNull().default(1),
  updatedAt: datetime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ---------- MySQL Relations ----------

export const mysqlGoodsReceiptsRelations = relations(mysqlGoodsReceipts, ({ one, many }) => ({
  po: one(mysqlPurchaseOrders, {
    fields: [mysqlGoodsReceipts.poId],
    references: [mysqlPurchaseOrders.id],
  }),
  wo: one(mysqlWorkOrders, {
    fields: [mysqlGoodsReceipts.woId],
    references: [mysqlWorkOrders.id],
  }),
  vendor: one(mysqlVendors, {
    fields: [mysqlGoodsReceipts.vendorId],
    references: [mysqlVendors.id],
  }),
  warehouse: one(mysqlWarehouses, {
    fields: [mysqlGoodsReceipts.warehouseId],
    references: [mysqlWarehouses.id],
  }),
  receiver: one(mysqlUsers, {
    fields: [mysqlGoodsReceipts.receiverUserId],
    references: [mysqlUsers.id],
  }),
  lines: many(mysqlGoodsReceiptLines),
}));

export const mysqlGoodsReceiptLinesRelations = relations(mysqlGoodsReceiptLines, ({ one }) => ({
  grn: one(mysqlGoodsReceipts, {
    fields: [mysqlGoodsReceiptLines.grnId],
    references: [mysqlGoodsReceipts.id],
  }),
  item: one(mysqlItems, {
    fields: [mysqlGoodsReceiptLines.itemId],
    references: [mysqlItems.id],
  }),
  inventoryLot: one(mysqlInventoryLots, {
    fields: [mysqlGoodsReceiptLines.inventoryLotId],
    references: [mysqlInventoryLots.id],
  }),
  qcSample: one(mysqlQcSamples, {
    fields: [mysqlGoodsReceiptLines.qcSampleId],
    references: [mysqlQcSamples.id],
  }),
  checklist: one(mysqlGoodsReceiptChecklists, {
    fields: [mysqlGoodsReceiptLines.id],
    references: [mysqlGoodsReceiptChecklists.lineId],
  }),
  receiverSignature: one(mysqlElectronicSignatures, {
    fields: [mysqlGoodsReceiptLines.receiverSignatureId],
    references: [mysqlElectronicSignatures.id],
  }),
  qaSignature: one(mysqlElectronicSignatures, {
    fields: [mysqlGoodsReceiptLines.qaSignatureId],
    references: [mysqlElectronicSignatures.id],
  }),
}));

export const mysqlGoodsReceiptChecklistsRelations = relations(
  mysqlGoodsReceiptChecklists,
  ({ one }) => ({
    line: one(mysqlGoodsReceiptLines, {
      fields: [mysqlGoodsReceiptChecklists.lineId],
      references: [mysqlGoodsReceiptLines.id],
    }),
    signature: one(mysqlElectronicSignatures, {
      fields: [mysqlGoodsReceiptChecklists.signatureId],
      references: [mysqlElectronicSignatures.id],
    }),
  }),
);

// ============================================
// TypeScript Types
// ============================================

export type GoodsReceiptDb = typeof sqliteGoodsReceipts.$inferSelect;
export type NewGoodsReceiptDb = typeof sqliteGoodsReceipts.$inferInsert;
export type GoodsReceiptLineDb = typeof sqliteGoodsReceiptLines.$inferSelect;
export type NewGoodsReceiptLineDb = typeof sqliteGoodsReceiptLines.$inferInsert;
export type GoodsReceiptChecklistDb = typeof sqliteGoodsReceiptChecklists.$inferSelect;
export type NewGoodsReceiptChecklistDb = typeof sqliteGoodsReceiptChecklists.$inferInsert;
export type ReceiptChecklistTemplateDb = typeof sqliteReceiptChecklistTemplates.$inferSelect;
export type NewReceiptChecklistTemplateDb = typeof sqliteReceiptChecklistTemplates.$inferInsert;
export type ReceiptToleranceDb = typeof sqliteReceiptTolerances.$inferSelect;
export type NewReceiptToleranceDb = typeof sqliteReceiptTolerances.$inferInsert;
export type GoodsReceiptSequenceDb = typeof sqliteGoodsReceiptSequences.$inferSelect;
export type NewGoodsReceiptSequenceDb = typeof sqliteGoodsReceiptSequences.$inferInsert;
