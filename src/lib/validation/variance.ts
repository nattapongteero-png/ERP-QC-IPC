/**
 * Variance Analysis Validation Schemas (T130)
 * Part of 011-accounting-spec-gap - User Story 6
 */

import { z } from 'zod';

// Variance type enum
export const varianceTypeEnum = z.enum([
  'mpv',      // Material Price Variance
  'muv',      // Material Usage Variance
  'lrv',      // Labor Rate Variance
  'lev',      // Labor Efficiency Variance
  'voh_var',  // Variable Overhead Variance
  'foh_vol',  // Fixed Overhead Volume Variance
]);

// Standard Cost schemas
export const standardCostCreateSchema = z.object({
  itemId: z.number().positive('Item ID is required'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  materialCost: z.number().min(0, 'Material cost cannot be negative').optional().default(0),
  laborCost: z.number().min(0, 'Labor cost cannot be negative').optional().default(0),
  overheadCost: z.number().min(0, 'Overhead cost cannot be negative').optional().default(0),
  standardHours: z.number().min(0, 'Standard hours cannot be negative').optional().default(0),
  standardLaborRate: z.number().min(0, 'Standard labor rate cannot be negative').optional().default(0),
  notes: z.string().max(1000).optional(),
  setAsCurrent: z.boolean().optional().default(true),
});

export const standardCostUpdateSchema = z.object({
  id: z.number().positive('ID is required'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  materialCost: z.number().min(0, 'Material cost cannot be negative').optional(),
  laborCost: z.number().min(0, 'Labor cost cannot be negative').optional(),
  overheadCost: z.number().min(0, 'Overhead cost cannot be negative').optional(),
  standardHours: z.number().min(0, 'Standard hours cannot be negative').optional(),
  standardLaborRate: z.number().min(0, 'Standard labor rate cannot be negative').optional(),
  notes: z.string().max(1000).optional(),
  setAsCurrent: z.boolean().optional(),
});

// Roll-up request schema
export const rollupRequestSchema = z.object({
  itemIds: z.array(z.number().positive()).optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// Variance Record schemas
export const varianceRecordCreateSchema = z.object({
  workOrderId: z.number().positive('Work order ID is required'),
  itemId: z.number().positive('Item ID is required'),
  varianceType: varianceTypeEnum,
  varianceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  standardValue: z.number(),
  actualValue: z.number(),
  varianceAmount: z.number(),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().max(1000).optional(),
});

// Calculate variance request schema
export const calculateVarianceRequestSchema = z.object({
  workOrderId: z.number().positive('Work order ID is required'),
  postImmediately: z.boolean().optional().default(false),
});

// Post variance request schema
export const postVarianceRequestSchema = z.object({
  varianceIds: z.array(z.number().positive()).optional(),
  periodId: z.number().positive().optional(),
});

// Query filter schemas
// nullish + null-preprocessed dates so absent query params (null) don't 500.
// optDate is defined below; forward-declare a local copy here.
const _optDate = z.preprocess(
  (v) => (v === null || v === '' ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
);
export const varianceListFilterSchema = z.object({
  workOrderId: z.coerce.number().positive().nullish(),
  itemId: z.coerce.number().positive().nullish(),
  varianceType: z.preprocess((v) => (v === null || v === '' ? undefined : v), varianceTypeEnum.optional()),
  dateFrom: _optDate,
  dateTo: _optDate,
  isPosted: z.coerce.boolean().nullish(),
  page: z.coerce.number().positive().nullish().transform((v) => v ?? 1),
  limit: z.coerce.number().positive().max(100).nullish().transform((v) => v ?? 20),
});

// NOTE: these are query-param filter schemas. The routes build the input from
// searchParams.get(), which yields `null` for absent params. Use `.nullish()`
// (accepts null AND undefined) so an absent filter doesn't fail validation —
// `.optional()` alone rejects the literal `null` and 500s the listing pages.
// Empty-string dates are also treated as absent.
const optDate = z.preprocess(
  (v) => (v === null || v === '' ? undefined : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
);

export const standardCostListFilterSchema = z.object({
  itemId: z.coerce.number().positive().nullish(),
  isCurrent: z.coerce.boolean().nullish(),
  effectiveDate: optDate,
  page: z.coerce.number().positive().nullish().transform((v) => v ?? 1),
  limit: z.coerce.number().positive().max(100).nullish().transform((v) => v ?? 20),
});

// Report filter schemas
export const varianceSummaryFilterSchema = z.object({
  periodId: z.coerce.number().positive().nullish(),
  dateFrom: optDate,
  dateTo: optDate,
  groupBy: z.enum(['item', 'variance_type', 'work_order', 'month']).nullish().transform((v) => v ?? 'variance_type'),
});

export const materialVarianceFilterSchema = z.object({
  dateFrom: optDate,
  dateTo: optDate,
  itemId: z.coerce.number().positive().nullish(),
});

export const laborVarianceFilterSchema = z.object({
  dateFrom: optDate,
  dateTo: optDate,
  workCenterId: z.coerce.number().positive().nullish(),
});

// Export types
export type StandardCostCreate = z.infer<typeof standardCostCreateSchema>;
export type StandardCostUpdate = z.infer<typeof standardCostUpdateSchema>;
export type RollupRequest = z.infer<typeof rollupRequestSchema>;
export type VarianceRecordCreate = z.infer<typeof varianceRecordCreateSchema>;
export type CalculateVarianceRequest = z.infer<typeof calculateVarianceRequestSchema>;
export type PostVarianceRequest = z.infer<typeof postVarianceRequestSchema>;
export type VarianceListFilter = z.infer<typeof varianceListFilterSchema>;
export type StandardCostListFilter = z.infer<typeof standardCostListFilterSchema>;
export type VarianceSummaryFilter = z.infer<typeof varianceSummaryFilterSchema>;
export type MaterialVarianceFilter = z.infer<typeof materialVarianceFilterSchema>;
export type LaborVarianceFilter = z.infer<typeof laborVarianceFilterSchema>;
