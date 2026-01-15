// Unit Cost Calculation System Schema
// Feature: 014-unit-cost
// This schema adds tables for WAC tracking, landed costs, production costs, and cost reporting

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { mysqlTable, varchar, int, decimal, datetime, boolean as mysqlBoolean, text as mysqlText } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import {
  sqliteItems,
  sqliteInventoryLots,
  sqlitePurchaseOrderLines,
  sqliteWorkOrders,
  sqliteOperations,
  sqliteGLAccounts,
  sqliteHROrgUnits,
  sqliteHREmployees,
  mysqlItems,
  mysqlInventoryLots,
  mysqlPurchaseOrderLines,
  mysqlWorkOrders,
  mysqlOperations,
  mysqlGLAccounts,
  mysqlHROrgUnits,
  mysqlHREmployees,
} from './schema';

// ============================================
// SQLite Schema (for unit testing)
// ============================================

// Work Centers (Production Locations with Cost Rates)
export const sqliteWorkCenters = sqliteTable('work_centers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  nameTh: text('name_th'),
  orgUnitId: integer('org_unit_id').references(() => sqliteHROrgUnits.id),
  laborRatePerHour: real('labor_rate_per_hour').notNull().default(0),
  overheadRatePerHour: real('overhead_rate_per_hour').notNull().default(0),
  machineRatePerHour: real('machine_rate_per_hour').notNull().default(0),
  capacityHoursPerDay: real('capacity_hours_per_day'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Item Cost Layers (WAC Audit Trail)
export const sqliteItemCostLayers = sqliteTable('item_cost_layers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  transactionType: text('transaction_type').notNull(), // receipt, landed_cost, adjustment, return
  transactionId: integer('transaction_id').notNull(),
  transactionDate: text('transaction_date').notNull(),
  quantityIn: real('quantity_in').notNull(), // Can be negative for returns/adjustments
  unitCost: real('unit_cost').notNull(),
  totalCost: real('total_cost').notNull(),
  runningQty: real('running_qty').notNull(),
  runningTotalCost: real('running_total_cost').notNull(),
  runningWAC: real('running_wac').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => sqliteHREmployees.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Landed Cost Headers
export const sqliteLandedCostHeaders = sqliteTable('landed_cost_headers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentNumber: text('document_number').notNull().unique(),
  referenceType: text('reference_type').notNull(), // po, shipment
  referenceId: integer('reference_id').notNull(),
  vendorId: integer('vendor_id'), // Freight forwarder/customs broker
  invoiceNumber: text('invoice_number'),
  invoiceDate: text('invoice_date'),
  totalAmount: real('total_amount').notNull().default(0),
  currency: text('currency').notNull().default('THB'),
  exchangeRate: real('exchange_rate').notNull().default(1),
  status: text('status').notNull().default('draft'), // draft, allocated, posted
  postedAt: text('posted_at'),
  postedBy: integer('posted_by').references(() => sqliteHREmployees.id),
  createdBy: integer('created_by').references(() => sqliteHREmployees.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Landed Cost Lines
export const sqliteLandedCostLines = sqliteTable('landed_cost_lines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  landedCostHeaderId: integer('landed_cost_header_id').notNull().references(() => sqliteLandedCostHeaders.id),
  costType: text('cost_type').notNull(), // freight, duty, insurance, handling, inspection, other
  description: text('description'),
  amount: real('amount').notNull(),
  allocationBasis: text('allocation_basis').notNull().default('value'), // value, quantity, weight, volume
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Landed Cost Allocations
export const sqliteLandedCostAllocations = sqliteTable('landed_cost_allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  landedCostLineId: integer('landed_cost_line_id').notNull().references(() => sqliteLandedCostLines.id),
  landedCostHeaderId: integer('landed_cost_header_id').notNull().references(() => sqliteLandedCostHeaders.id),
  itemId: integer('item_id').notNull().references(() => sqliteItems.id),
  lotId: integer('lot_id').references(() => sqliteInventoryLots.id),
  poLineId: integer('po_line_id').references(() => sqlitePurchaseOrderLines.id),
  allocatedAmount: real('allocated_amount').notNull(),
  basisValue: real('basis_value').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Overhead Rates
export const sqliteOverheadRates = sqliteTable('overhead_rates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  orgUnitId: integer('org_unit_id').references(() => sqliteHROrgUnits.id),
  workCenterId: integer('work_center_id').references(() => sqliteWorkCenters.id),
  overheadType: text('overhead_type').notNull(), // fixed, variable, mixed
  allocationBasis: text('allocation_basis').notNull(), // labor_hours, machine_hours, units, direct_labor_cost
  ratePerUnit: real('rate_per_unit').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  effectiveTo: text('effective_to'),
  glAccountId: integer('gl_account_id').references(() => sqliteGLAccounts.id),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Work Order Operations (Time Tracking)
export const sqliteWorkOrderOperations = sqliteTable('work_order_operations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id').notNull().references(() => sqliteWorkOrders.id),
  operationId: integer('operation_id').notNull().references(() => sqliteOperations.id),
  workCenterId: integer('work_center_id').notNull().references(() => sqliteWorkCenters.id),
  sequence: integer('sequence').notNull(),
  plannedHours: real('planned_hours').notNull().default(0),
  actualHours: real('actual_hours'),
  laborRate: real('labor_rate').notNull(), // Snapshot at production time
  laborCost: real('labor_cost'), // actualHours × laborRate
  overheadRate: real('overhead_rate').notNull(), // Snapshot at production time
  overheadCost: real('overhead_cost'), // actualHours × overheadRate
  startTime: text('start_time'),
  endTime: text('end_time'),
  operatorId: integer('operator_id').references(() => sqliteHREmployees.id),
  status: text('status').notNull().default('pending'), // pending, in_progress, completed, skipped
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Work Order Costs (Aggregated Summary)
export const sqliteWorkOrderCosts = sqliteTable('work_order_costs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workOrderId: integer('work_order_id').notNull().unique().references(() => sqliteWorkOrders.id),
  materialCost: real('material_cost').notNull().default(0),
  laborCost: real('labor_cost').notNull().default(0),
  overheadCost: real('overhead_cost').notNull().default(0),
  totalCost: real('total_cost').notNull().default(0),
  producedQuantity: real('produced_quantity'),
  unitCost: real('unit_cost'), // totalCost ÷ producedQuantity
  status: text('status').notNull().default('in_progress'), // in_progress, completed, adjusted
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Cost GL Mapping
export const sqliteCostGLMapping = sqliteTable('cost_gl_mapping', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionType: text('transaction_type').notNull(), // material_receipt, landed_cost, material_issue, labor, overhead, fg_transfer, cogs, variance
  itemType: text('item_type').notNull(), // raw_material, packaging, wip, finished_goods, consumable
  debitAccountId: integer('debit_account_id').notNull().references(() => sqliteGLAccounts.id),
  creditAccountId: integer('credit_account_id').notNull().references(() => sqliteGLAccounts.id),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// Confidential Access Groups (014-unit-cost)
// Groups that can be granted access to confidential BOMs
export const sqliteConfidentialAccessGroups = sqliteTable('confidential_access_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================
// SQLite Relations
// ============================================

export const sqliteWorkCentersRelations = relations(sqliteWorkCenters, ({ one, many }) => ({
  orgUnit: one(sqliteHROrgUnits, {
    fields: [sqliteWorkCenters.orgUnitId],
    references: [sqliteHROrgUnits.id],
  }),
  overheadRates: many(sqliteOverheadRates),
  operations: many(sqliteWorkOrderOperations),
}));

export const sqliteItemCostLayersRelations = relations(sqliteItemCostLayers, ({ one }) => ({
  item: one(sqliteItems, {
    fields: [sqliteItemCostLayers.itemId],
    references: [sqliteItems.id],
  }),
  createdByUser: one(sqliteHREmployees, {
    fields: [sqliteItemCostLayers.createdBy],
    references: [sqliteHREmployees.id],
  }),
}));

export const sqliteLandedCostHeadersRelations = relations(sqliteLandedCostHeaders, ({ one, many }) => ({
  lines: many(sqliteLandedCostLines),
  allocations: many(sqliteLandedCostAllocations),
  postedByUser: one(sqliteHREmployees, {
    fields: [sqliteLandedCostHeaders.postedBy],
    references: [sqliteHREmployees.id],
  }),
  createdByUser: one(sqliteHREmployees, {
    fields: [sqliteLandedCostHeaders.createdBy],
    references: [sqliteHREmployees.id],
  }),
}));

export const sqliteLandedCostLinesRelations = relations(sqliteLandedCostLines, ({ one, many }) => ({
  header: one(sqliteLandedCostHeaders, {
    fields: [sqliteLandedCostLines.landedCostHeaderId],
    references: [sqliteLandedCostHeaders.id],
  }),
  allocations: many(sqliteLandedCostAllocations),
}));

export const sqliteLandedCostAllocationsRelations = relations(sqliteLandedCostAllocations, ({ one }) => ({
  line: one(sqliteLandedCostLines, {
    fields: [sqliteLandedCostAllocations.landedCostLineId],
    references: [sqliteLandedCostLines.id],
  }),
  header: one(sqliteLandedCostHeaders, {
    fields: [sqliteLandedCostAllocations.landedCostHeaderId],
    references: [sqliteLandedCostHeaders.id],
  }),
  item: one(sqliteItems, {
    fields: [sqliteLandedCostAllocations.itemId],
    references: [sqliteItems.id],
  }),
  lot: one(sqliteInventoryLots, {
    fields: [sqliteLandedCostAllocations.lotId],
    references: [sqliteInventoryLots.id],
  }),
  poLine: one(sqlitePurchaseOrderLines, {
    fields: [sqliteLandedCostAllocations.poLineId],
    references: [sqlitePurchaseOrderLines.id],
  }),
}));

export const sqliteOverheadRatesRelations = relations(sqliteOverheadRates, ({ one }) => ({
  orgUnit: one(sqliteHROrgUnits, {
    fields: [sqliteOverheadRates.orgUnitId],
    references: [sqliteHROrgUnits.id],
  }),
  workCenter: one(sqliteWorkCenters, {
    fields: [sqliteOverheadRates.workCenterId],
    references: [sqliteWorkCenters.id],
  }),
  glAccount: one(sqliteGLAccounts, {
    fields: [sqliteOverheadRates.glAccountId],
    references: [sqliteGLAccounts.id],
  }),
}));

export const sqliteWorkOrderOperationsRelations = relations(sqliteWorkOrderOperations, ({ one }) => ({
  workOrder: one(sqliteWorkOrders, {
    fields: [sqliteWorkOrderOperations.workOrderId],
    references: [sqliteWorkOrders.id],
  }),
  operation: one(sqliteOperations, {
    fields: [sqliteWorkOrderOperations.operationId],
    references: [sqliteOperations.id],
  }),
  workCenter: one(sqliteWorkCenters, {
    fields: [sqliteWorkOrderOperations.workCenterId],
    references: [sqliteWorkCenters.id],
  }),
  operator: one(sqliteHREmployees, {
    fields: [sqliteWorkOrderOperations.operatorId],
    references: [sqliteHREmployees.id],
  }),
}));

export const sqliteWorkOrderCostsRelations = relations(sqliteWorkOrderCosts, ({ one }) => ({
  workOrder: one(sqliteWorkOrders, {
    fields: [sqliteWorkOrderCosts.workOrderId],
    references: [sqliteWorkOrders.id],
  }),
}));

export const sqliteCostGLMappingRelations = relations(sqliteCostGLMapping, ({ one }) => ({
  debitAccount: one(sqliteGLAccounts, {
    fields: [sqliteCostGLMapping.debitAccountId],
    references: [sqliteGLAccounts.id],
  }),
  creditAccount: one(sqliteGLAccounts, {
    fields: [sqliteCostGLMapping.creditAccountId],
    references: [sqliteGLAccounts.id],
  }),
}));

// ============================================
// MySQL Schema (for production)
// ============================================

// Work Centers
export const mysqlWorkCenters = mysqlTable('work_centers', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameTh: varchar('name_th', { length: 100 }),
  orgUnitId: int('org_unit_id').references(() => mysqlHROrgUnits.id),
  laborRatePerHour: decimal('labor_rate_per_hour', { precision: 15, scale: 4 }).notNull().default('0'),
  overheadRatePerHour: decimal('overhead_rate_per_hour', { precision: 15, scale: 4 }).notNull().default('0'),
  machineRatePerHour: decimal('machine_rate_per_hour', { precision: 15, scale: 4 }).notNull().default('0'),
  capacityHoursPerDay: decimal('capacity_hours_per_day', { precision: 10, scale: 2 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Item Cost Layers
export const mysqlItemCostLayers = mysqlTable('item_cost_layers', {
  id: int('id').primaryKey().autoincrement(),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  transactionType: varchar('transaction_type', { length: 20 }).notNull(),
  transactionId: int('transaction_id').notNull(),
  transactionDate: datetime('transaction_date').notNull(),
  quantityIn: decimal('quantity_in', { precision: 15, scale: 4 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 15, scale: 4 }).notNull(),
  totalCost: decimal('total_cost', { precision: 15, scale: 4 }).notNull(),
  runningQty: decimal('running_qty', { precision: 15, scale: 4 }).notNull(),
  runningTotalCost: decimal('running_total_cost', { precision: 15, scale: 4 }).notNull(),
  runningWAC: decimal('running_wac', { precision: 15, scale: 4 }).notNull(),
  notes: mysqlText('notes'),
  createdBy: int('created_by').references(() => mysqlHREmployees.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Landed Cost Headers
export const mysqlLandedCostHeaders = mysqlTable('landed_cost_headers', {
  id: int('id').primaryKey().autoincrement(),
  documentNumber: varchar('document_number', { length: 30 }).notNull().unique(),
  referenceType: varchar('reference_type', { length: 20 }).notNull(),
  referenceId: int('reference_id').notNull(),
  vendorId: int('vendor_id'),
  invoiceNumber: varchar('invoice_number', { length: 50 }),
  invoiceDate: datetime('invoice_date'),
  totalAmount: decimal('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('THB'),
  exchangeRate: decimal('exchange_rate', { precision: 10, scale: 6 }).notNull().default('1'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  postedAt: datetime('posted_at'),
  postedBy: int('posted_by').references(() => mysqlHREmployees.id),
  createdBy: int('created_by').references(() => mysqlHREmployees.id),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Landed Cost Lines
export const mysqlLandedCostLines = mysqlTable('landed_cost_lines', {
  id: int('id').primaryKey().autoincrement(),
  landedCostHeaderId: int('landed_cost_header_id').notNull().references(() => mysqlLandedCostHeaders.id),
  costType: varchar('cost_type', { length: 20 }).notNull(),
  description: varchar('description', { length: 200 }),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  allocationBasis: varchar('allocation_basis', { length: 20 }).notNull().default('value'),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Landed Cost Allocations
export const mysqlLandedCostAllocations = mysqlTable('landed_cost_allocations', {
  id: int('id').primaryKey().autoincrement(),
  landedCostLineId: int('landed_cost_line_id').notNull().references(() => mysqlLandedCostLines.id),
  landedCostHeaderId: int('landed_cost_header_id').notNull().references(() => mysqlLandedCostHeaders.id),
  itemId: int('item_id').notNull().references(() => mysqlItems.id),
  lotId: int('lot_id').references(() => mysqlInventoryLots.id),
  poLineId: int('po_line_id').references(() => mysqlPurchaseOrderLines.id),
  allocatedAmount: decimal('allocated_amount', { precision: 15, scale: 4 }).notNull(),
  basisValue: decimal('basis_value', { precision: 15, scale: 4 }).notNull(),
  createdAt: datetime('created_at').notNull().default(new Date()),
});

// Overhead Rates
export const mysqlOverheadRates = mysqlTable('overhead_rates', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  orgUnitId: int('org_unit_id').references(() => mysqlHROrgUnits.id),
  workCenterId: int('work_center_id').references(() => mysqlWorkCenters.id),
  overheadType: varchar('overhead_type', { length: 20 }).notNull(),
  allocationBasis: varchar('allocation_basis', { length: 30 }).notNull(),
  ratePerUnit: decimal('rate_per_unit', { precision: 15, scale: 4 }).notNull(),
  effectiveFrom: datetime('effective_from').notNull(),
  effectiveTo: datetime('effective_to'),
  glAccountId: int('gl_account_id').references(() => mysqlGLAccounts.id),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Work Order Operations
export const mysqlWorkOrderOperations = mysqlTable('work_order_operations', {
  id: int('id').primaryKey().autoincrement(),
  workOrderId: int('work_order_id').notNull().references(() => mysqlWorkOrders.id),
  operationId: int('operation_id').notNull().references(() => mysqlOperations.id),
  workCenterId: int('work_center_id').notNull().references(() => mysqlWorkCenters.id),
  sequence: int('sequence').notNull(),
  plannedHours: decimal('planned_hours', { precision: 10, scale: 2 }).notNull().default('0'),
  actualHours: decimal('actual_hours', { precision: 10, scale: 2 }),
  laborRate: decimal('labor_rate', { precision: 15, scale: 4 }).notNull(),
  laborCost: decimal('labor_cost', { precision: 15, scale: 4 }),
  overheadRate: decimal('overhead_rate', { precision: 15, scale: 4 }).notNull(),
  overheadCost: decimal('overhead_cost', { precision: 15, scale: 4 }),
  startTime: datetime('start_time'),
  endTime: datetime('end_time'),
  operatorId: int('operator_id').references(() => mysqlHREmployees.id),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  notes: mysqlText('notes'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Work Order Costs
export const mysqlWorkOrderCosts = mysqlTable('work_order_costs', {
  id: int('id').primaryKey().autoincrement(),
  workOrderId: int('work_order_id').notNull().unique().references(() => mysqlWorkOrders.id),
  materialCost: decimal('material_cost', { precision: 15, scale: 4 }).notNull().default('0'),
  laborCost: decimal('labor_cost', { precision: 15, scale: 4 }).notNull().default('0'),
  overheadCost: decimal('overhead_cost', { precision: 15, scale: 4 }).notNull().default('0'),
  totalCost: decimal('total_cost', { precision: 15, scale: 4 }).notNull().default('0'),
  producedQuantity: decimal('produced_quantity', { precision: 15, scale: 4 }),
  unitCost: decimal('unit_cost', { precision: 15, scale: 4 }),
  status: varchar('status', { length: 20 }).notNull().default('in_progress'),
  completedAt: datetime('completed_at'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Cost GL Mapping
export const mysqlCostGLMapping = mysqlTable('cost_gl_mapping', {
  id: int('id').primaryKey().autoincrement(),
  transactionType: varchar('transaction_type', { length: 30 }).notNull(),
  itemType: varchar('item_type', { length: 30 }).notNull(),
  debitAccountId: int('debit_account_id').notNull().references(() => mysqlGLAccounts.id),
  creditAccountId: int('credit_account_id').notNull().references(() => mysqlGLAccounts.id),
  description: varchar('description', { length: 200 }),
  isActive: mysqlBoolean('is_active').notNull().default(true),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// Confidential Access Groups (014-unit-cost)
// Groups that can be granted access to confidential BOMs
export const mysqlConfidentialAccessGroups = mysqlTable('confidential_access_groups', {
  id: int('id').primaryKey().autoincrement(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: mysqlText('description'),
  createdAt: datetime('created_at').notNull().default(new Date()),
  updatedAt: datetime('updated_at').notNull().default(new Date()),
});

// ============================================
// MySQL Relations
// ============================================

export const mysqlWorkCentersRelations = relations(mysqlWorkCenters, ({ one, many }) => ({
  orgUnit: one(mysqlHROrgUnits, {
    fields: [mysqlWorkCenters.orgUnitId],
    references: [mysqlHROrgUnits.id],
  }),
  overheadRates: many(mysqlOverheadRates),
  operations: many(mysqlWorkOrderOperations),
}));

export const mysqlItemCostLayersRelations = relations(mysqlItemCostLayers, ({ one }) => ({
  item: one(mysqlItems, {
    fields: [mysqlItemCostLayers.itemId],
    references: [mysqlItems.id],
  }),
  createdByUser: one(mysqlHREmployees, {
    fields: [mysqlItemCostLayers.createdBy],
    references: [mysqlHREmployees.id],
  }),
}));

export const mysqlLandedCostHeadersRelations = relations(mysqlLandedCostHeaders, ({ one, many }) => ({
  lines: many(mysqlLandedCostLines),
  allocations: many(mysqlLandedCostAllocations),
  postedByUser: one(mysqlHREmployees, {
    fields: [mysqlLandedCostHeaders.postedBy],
    references: [mysqlHREmployees.id],
  }),
  createdByUser: one(mysqlHREmployees, {
    fields: [mysqlLandedCostHeaders.createdBy],
    references: [mysqlHREmployees.id],
  }),
}));

export const mysqlLandedCostLinesRelations = relations(mysqlLandedCostLines, ({ one, many }) => ({
  header: one(mysqlLandedCostHeaders, {
    fields: [mysqlLandedCostLines.landedCostHeaderId],
    references: [mysqlLandedCostHeaders.id],
  }),
  allocations: many(mysqlLandedCostAllocations),
}));

export const mysqlLandedCostAllocationsRelations = relations(mysqlLandedCostAllocations, ({ one }) => ({
  line: one(mysqlLandedCostLines, {
    fields: [mysqlLandedCostAllocations.landedCostLineId],
    references: [mysqlLandedCostLines.id],
  }),
  header: one(mysqlLandedCostHeaders, {
    fields: [mysqlLandedCostAllocations.landedCostHeaderId],
    references: [mysqlLandedCostHeaders.id],
  }),
  item: one(mysqlItems, {
    fields: [mysqlLandedCostAllocations.itemId],
    references: [mysqlItems.id],
  }),
  lot: one(mysqlInventoryLots, {
    fields: [mysqlLandedCostAllocations.lotId],
    references: [mysqlInventoryLots.id],
  }),
  poLine: one(mysqlPurchaseOrderLines, {
    fields: [mysqlLandedCostAllocations.poLineId],
    references: [mysqlPurchaseOrderLines.id],
  }),
}));

export const mysqlOverheadRatesRelations = relations(mysqlOverheadRates, ({ one }) => ({
  orgUnit: one(mysqlHROrgUnits, {
    fields: [mysqlOverheadRates.orgUnitId],
    references: [mysqlHROrgUnits.id],
  }),
  workCenter: one(mysqlWorkCenters, {
    fields: [mysqlOverheadRates.workCenterId],
    references: [mysqlWorkCenters.id],
  }),
  glAccount: one(mysqlGLAccounts, {
    fields: [mysqlOverheadRates.glAccountId],
    references: [mysqlGLAccounts.id],
  }),
}));

export const mysqlWorkOrderOperationsRelations = relations(mysqlWorkOrderOperations, ({ one }) => ({
  workOrder: one(mysqlWorkOrders, {
    fields: [mysqlWorkOrderOperations.workOrderId],
    references: [mysqlWorkOrders.id],
  }),
  operation: one(mysqlOperations, {
    fields: [mysqlWorkOrderOperations.operationId],
    references: [mysqlOperations.id],
  }),
  workCenter: one(mysqlWorkCenters, {
    fields: [mysqlWorkOrderOperations.workCenterId],
    references: [mysqlWorkCenters.id],
  }),
  operator: one(mysqlHREmployees, {
    fields: [mysqlWorkOrderOperations.operatorId],
    references: [mysqlHREmployees.id],
  }),
}));

export const mysqlWorkOrderCostsRelations = relations(mysqlWorkOrderCosts, ({ one }) => ({
  workOrder: one(mysqlWorkOrders, {
    fields: [mysqlWorkOrderCosts.workOrderId],
    references: [mysqlWorkOrders.id],
  }),
}));

export const mysqlCostGLMappingRelations = relations(mysqlCostGLMapping, ({ one }) => ({
  debitAccount: one(mysqlGLAccounts, {
    fields: [mysqlCostGLMapping.debitAccountId],
    references: [mysqlGLAccounts.id],
  }),
  creditAccount: one(mysqlGLAccounts, {
    fields: [mysqlCostGLMapping.creditAccountId],
    references: [mysqlGLAccounts.id],
  }),
}));

// ============================================
// Type Exports (inferred from SQLite schema)
// ============================================

export type WorkCenter = typeof sqliteWorkCenters.$inferSelect;
export type NewWorkCenter = typeof sqliteWorkCenters.$inferInsert;
export type ItemCostLayer = typeof sqliteItemCostLayers.$inferSelect;
export type NewItemCostLayer = typeof sqliteItemCostLayers.$inferInsert;
export type LandedCostHeader = typeof sqliteLandedCostHeaders.$inferSelect;
export type NewLandedCostHeader = typeof sqliteLandedCostHeaders.$inferInsert;
export type LandedCostLine = typeof sqliteLandedCostLines.$inferSelect;
export type NewLandedCostLine = typeof sqliteLandedCostLines.$inferInsert;
export type LandedCostAllocation = typeof sqliteLandedCostAllocations.$inferSelect;
export type NewLandedCostAllocation = typeof sqliteLandedCostAllocations.$inferInsert;
export type OverheadRate = typeof sqliteOverheadRates.$inferSelect;
export type NewOverheadRate = typeof sqliteOverheadRates.$inferInsert;
export type WorkOrderOperation = typeof sqliteWorkOrderOperations.$inferSelect;
export type NewWorkOrderOperation = typeof sqliteWorkOrderOperations.$inferInsert;
export type WorkOrderCostDb = typeof sqliteWorkOrderCosts.$inferSelect;
export type NewWorkOrderCostDb = typeof sqliteWorkOrderCosts.$inferInsert;
export type CostGLMapping = typeof sqliteCostGLMapping.$inferSelect;
export type NewCostGLMapping = typeof sqliteCostGLMapping.$inferInsert;
export type ConfidentialAccessGroup = typeof sqliteConfidentialAccessGroups.$inferSelect;
export type NewConfidentialAccessGroup = typeof sqliteConfidentialAccessGroups.$inferInsert;
