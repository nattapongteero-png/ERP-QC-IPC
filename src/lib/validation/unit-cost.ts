// Unit Cost Calculation System Validation Schemas
// Feature: 014-unit-cost

import { z } from 'zod';

// Date regex pattern for YYYY-MM-DD format
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// ENUMS
// ============================================================================

export const costLayerTransactionTypeSchema = z.enum([
  'receipt',
  'landed_cost',
  'adjustment',
  'return',
]);

export const landedCostTypeSchema = z.enum([
  'freight',
  'duty',
  'insurance',
  'handling',
  'inspection',
  'other',
]);

export const allocationBasisSchema = z.enum(['value', 'quantity', 'weight', 'volume']);

export const landedCostStatusSchema = z.enum(['draft', 'allocated', 'posted']);

export const landedCostReferenceTypeSchema = z.enum(['po', 'shipment']);

export const overheadTypeSchema = z.enum(['fixed', 'variable', 'mixed']);

export const overheadAllocationBasisSchema = z.enum([
  'labor_hours',
  'machine_hours',
  'units',
  'direct_labor_cost',
]);

export const workOrderOperationStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'skipped',
]);

export const workOrderCostStatusSchema = z.enum(['in_progress', 'completed', 'adjusted']);

export const costGLTransactionTypeSchema = z.enum([
  'material_receipt',
  'landed_cost',
  'material_issue',
  'labor',
  'overhead',
  'fg_transfer',
  'cogs',
  'variance',
]);

export const itemTypeSchema = z.enum([
  'raw_material',
  'packaging',
  'wip',
  'finished_goods',
  'consumable',
]);

// ============================================================================
// WORK CENTERS
// ============================================================================

export const workCenterCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  nameTh: z.string().max(100, 'Thai name must be 100 characters or less').optional().nullable(),
  orgUnitId: z.number().int().positive().optional().nullable(),
  laborRatePerHour: z.number().min(0, 'Labor rate must be 0 or greater').optional().default(0),
  overheadRatePerHour: z.number().min(0, 'Overhead rate must be 0 or greater').optional().default(0),
  machineRatePerHour: z.number().min(0, 'Machine rate must be 0 or greater').optional().default(0),
  capacityHoursPerDay: z.number().min(0, 'Capacity must be 0 or greater').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const workCenterUpdateSchema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  nameTh: z.string().max(100).optional().nullable(),
  orgUnitId: z.number().int().positive().optional().nullable(),
  laborRatePerHour: z.number().min(0).optional(),
  overheadRatePerHour: z.number().min(0).optional(),
  machineRatePerHour: z.number().min(0).optional(),
  capacityHoursPerDay: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// LANDED COSTS
// ============================================================================

export const landedCostLineCreateSchema = z.object({
  costType: landedCostTypeSchema,
  description: z.string().max(200, 'Description must be 200 characters or less').optional().nullable(),
  amount: z.number().min(0, 'Amount must be 0 or greater'),
  allocationBasis: allocationBasisSchema.optional().default('value'),
});

export const landedCostCreateSchema = z.object({
  referenceType: landedCostReferenceTypeSchema,
  referenceId: z.number().int().positive('Reference ID is required'),
  vendorId: z.number().int().positive().optional().nullable(),
  invoiceNumber: z.string().max(50, 'Invoice number must be 50 characters or less').optional().nullable(),
  invoiceDate: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  currency: z.string().length(3, 'Currency must be 3 characters').optional().default('THB'),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional().default(1),
  lines: z.array(landedCostLineCreateSchema).min(1, 'At least one cost line is required').optional(),
});

export const landedCostUpdateSchema = z.object({
  vendorId: z.number().int().positive().optional().nullable(),
  invoiceNumber: z.string().max(50).optional().nullable(),
  invoiceDate: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  currency: z.string().length(3).optional(),
  exchangeRate: z.number().positive().optional(),
  lines: z.array(landedCostLineCreateSchema).optional(),
});

// ============================================================================
// OVERHEAD RATES
// ============================================================================

export const overheadRateCreateSchema = z.object({
  code: z
    .string()
    .min(1, 'Code is required')
    .max(20, 'Code must be 20 characters or less'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less'),
  orgUnitId: z.number().int().positive().optional().nullable(),
  workCenterId: z.number().int().positive().optional().nullable(),
  overheadType: overheadTypeSchema,
  allocationBasis: overheadAllocationBasisSchema,
  ratePerUnit: z.number().min(0, 'Rate must be 0 or greater'),
  effectiveFrom: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format'),
  effectiveTo: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  glAccountId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const overheadRateUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ratePerUnit: z.number().min(0).optional(),
  effectiveTo: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// WORK ORDER OPERATIONS
// ============================================================================

export const workOrderOperationUpdateSchema = z.object({
  actualHours: z.number().min(0, 'Actual hours must be 0 or greater').optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  operatorId: z.number().int().positive().optional().nullable(),
  status: workOrderOperationStatusSchema.optional(),
  notes: z.string().max(1000, 'Notes must be 1000 characters or less').optional().nullable(),
});

export const workOrderOperationsUpdateSchema = z.object({
  operations: z.array(
    z.object({
      id: z.number().int().positive('Operation ID is required'),
      actualHours: z.number().min(0).optional().nullable(),
      startTime: z.string().optional().nullable(),
      endTime: z.string().optional().nullable(),
      operatorId: z.number().int().positive().optional().nullable(),
      status: workOrderOperationStatusSchema.optional(),
      notes: z.string().max(1000).optional().nullable(),
    })
  ),
});

// ============================================================================
// COST GL MAPPING
// ============================================================================

export const costGLMappingCreateSchema = z.object({
  transactionType: costGLTransactionTypeSchema,
  itemType: itemTypeSchema,
  debitAccountId: z.number().int().positive('Debit account is required'),
  creditAccountId: z.number().int().positive('Credit account is required'),
  description: z.string().max(200, 'Description must be 200 characters or less').optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).refine(
  (data) => data.debitAccountId !== data.creditAccountId,
  { message: 'Debit and credit accounts must be different', path: ['creditAccountId'] }
);

export const costGLMappingUpdateSchema = z.object({
  debitAccountId: z.number().int().positive().optional(),
  creditAccountId: z.number().int().positive().optional(),
  description: z.string().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// WAC RECALCULATION
// ============================================================================

export const recalculateWACInputSchema = z.object({
  itemId: z.number().int().positive('Item ID is required'),
  transactionType: costLayerTransactionTypeSchema,
  transactionId: z.number().int().positive('Transaction ID is required'),
  quantity: z.number().refine((val) => val !== 0, 'Quantity cannot be zero'),
  unitCost: z.number().min(0, 'Unit cost must be 0 or greater'),
  transactionDate: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format'),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional().nullable(),
  createdBy: z.number().int().positive('Created by user ID is required'),
});

// ============================================================================
// LIST FILTERS
// ============================================================================

export const workCenterListFiltersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const costLayerListFiltersSchema = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  transactionType: costLayerTransactionTypeSchema.optional(),
  fromDate: z.string().regex(datePattern).optional(),
  toDate: z.string().regex(datePattern).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const landedCostListFiltersSchema = z.object({
  status: landedCostStatusSchema.optional(),
  fromDate: z.string().regex(datePattern).optional(),
  toDate: z.string().regex(datePattern).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const overheadRateListFiltersSchema = z.object({
  workCenterId: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.boolean().optional(),
  effectiveDate: z.string().regex(datePattern).optional(),
});

// ============================================================================
// REPORT FILTERS
// ============================================================================

export const costSummaryReportFiltersSchema = z.object({
  itemType: itemTypeSchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  hasInventory: z.coerce.boolean().optional(),
  sortBy: z.enum([
    'itemCode',
    'itemName',
    'currentWAC',
    'onHandValue',
    'lastPurchaseCost',
    'lastProductionCost',
  ]).optional().default('itemCode'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const productionCostReportFiltersSchema = z.object({
  fromDate: z.string().regex(datePattern, 'From date is required'),
  toDate: z.string().regex(datePattern, 'To date is required'),
  itemId: z.coerce.number().int().positive().optional(),
  workCenterId: z.coerce.number().int().positive().optional(),
  status: z.enum(['in_progress', 'completed']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const marginAnalysisReportFiltersSchema = z.object({
  fromDate: z.string().regex(datePattern, 'From date is required'),
  toDate: z.string().regex(datePattern, 'To date is required'),
  groupBy: z.enum(['product', 'customer', 'salesRep', 'period']).optional().default('product'),
  itemId: z.coerce.number().int().positive().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const landedCostReportFiltersSchema = z.object({
  fromDate: z.string().regex(datePattern, 'From date is required'),
  toDate: z.string().regex(datePattern, 'To date is required'),
  vendorId: z.coerce.number().int().positive().optional(),
  itemId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(50),
});

export const dashboardKPIsFiltersSchema = z.object({
  period: z.enum(['mtd', 'qtd', 'ytd', 'last30', 'last90']).optional().default('mtd'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type WorkCenterCreateInput = z.infer<typeof workCenterCreateSchema>;
export type WorkCenterUpdateInput = z.infer<typeof workCenterUpdateSchema>;
export type LandedCostLineCreateInput = z.infer<typeof landedCostLineCreateSchema>;
export type LandedCostCreateInput = z.infer<typeof landedCostCreateSchema>;
export type LandedCostUpdateInput = z.infer<typeof landedCostUpdateSchema>;
export type OverheadRateCreateInput = z.infer<typeof overheadRateCreateSchema>;
export type OverheadRateUpdateInput = z.infer<typeof overheadRateUpdateSchema>;
export type WorkOrderOperationUpdateInput = z.infer<typeof workOrderOperationUpdateSchema>;
export type WorkOrderOperationsUpdateInput = z.infer<typeof workOrderOperationsUpdateSchema>;
export type CostGLMappingCreateInput = z.infer<typeof costGLMappingCreateSchema>;
export type CostGLMappingUpdateInput = z.infer<typeof costGLMappingUpdateSchema>;
export type RecalculateWACInput = z.infer<typeof recalculateWACInputSchema>;
