/**
 * 3-Way Matching Validation Schemas (T102)
 * Part of 011-accounting-spec-gap - User Story 4
 */

import { z } from 'zod';

/**
 * Tolerance Type Schema
 */
export const toleranceTypeSchema = z.enum(['quantity', 'price', 'amount']);

/**
 * Tolerance Method Schema
 */
export const toleranceMethodSchema = z.enum(['percentage', 'absolute']);

/**
 * Matching Status Schema
 */
export const matchingStatusSchema = z.enum([
  'pending',
  'matched',
  'exception',
  'approved',
  'rejected',
]);

/**
 * Exception Status Schema
 */
export const exceptionStatusSchema = z.enum(['pending', 'approved', 'rejected']);

/**
 * Exception Type Schema
 */
export const exceptionTypeSchema = z.enum([
  'quantity_variance',
  'price_variance',
  'amount_variance',
  'missing_grn',
  'missing_po',
  'partial_receipt',
]);

/**
 * Create Tolerance Schema
 */
export const toleranceCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  toleranceType: toleranceTypeSchema,
  toleranceMethod: toleranceMethodSchema,
  toleranceValue: z.number().min(0, 'Tolerance value must be non-negative'),
  currency: z.string().length(3).optional(),  // ISO currency code
  itemCategoryId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().min(1).max(100).optional().default(10),
}).refine(
  (data) => {
    // If method is percentage, value should be between 0 and 100
    if (data.toleranceMethod === 'percentage' && data.toleranceValue > 100) {
      return false;
    }
    // If method is absolute, currency should be provided
    if (data.toleranceMethod === 'absolute' && !data.currency) {
      // Allow without currency - will use default
      return true;
    }
    return true;
  },
  {
    message: 'Percentage tolerance must be between 0 and 100',
  }
);

/**
 * Update Tolerance Schema
 */
export const toleranceUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  toleranceValue: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(1).max(100).optional(),
});

/**
 * Tolerance List Filter Schema
 */
export const toleranceListFilterSchema = z.object({
  toleranceType: toleranceTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Tolerance Override Schema
 */
export const toleranceOverrideSchema = z.object({
  toleranceType: toleranceTypeSchema,
  toleranceMethod: toleranceMethodSchema,
  toleranceValue: z.number().min(0),
});

/**
 * Matching Request Schema
 */
export const matchingRequestSchema = z.object({
  invoiceId: z.number().int().positive('Invoice ID is required'),
  toleranceOverrides: z.array(toleranceOverrideSchema).optional(),
});

/**
 * Exception List Filter Schema
 */
// Built from searchParams.get() which yields `null` for absent params, so use
// `.nullish()` (null + undefined) — plain `.optional()` rejects literal null and
// 500s the page. Empty strings are treated as absent.
const nullishStr = z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional());
export const exceptionListFilterSchema = z.object({
  status: z.preprocess((v) => (v === null || v === '' ? undefined : v), exceptionStatusSchema.optional()),
  exceptionType: z.preprocess((v) => (v === null || v === '' ? undefined : v), exceptionTypeSchema.optional()),
  vendorId: z.coerce.number().int().positive().nullish(),
  fromDate: nullishStr,
  toDate: nullishStr,
  search: nullishStr,
  page: z.coerce.number().int().positive().nullish().transform((v) => v ?? 1),
  limit: z.coerce.number().int().positive().max(100).nullish().transform((v) => v ?? 20),
});

/**
 * Exception Review Schema
 */
export const exceptionReviewSchema = z.object({
  exceptionId: z.number().int().positive('Exception ID is required'),
  approved: z.boolean(),
  comments: z.string().max(500).optional(),
});

/**
 * GR/IR Report Filter Schema
 */
export const grirReportFilterSchema = z.object({
  asOfDate: nullishStr,
  vendorId: z.coerce.number().int().positive().nullish(),
  status: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(['open', 'partial', 'cleared', 'all']).nullish()).transform((v) => v ?? 'open'),
  page: z.coerce.number().int().positive().nullish().transform((v) => v ?? 1),
  limit: z.coerce.number().int().positive().max(100).nullish().transform((v) => v ?? 50),
});

// Type exports
export type ToleranceType = z.infer<typeof toleranceTypeSchema>;
export type ToleranceMethod = z.infer<typeof toleranceMethodSchema>;
export type MatchingStatus = z.infer<typeof matchingStatusSchema>;
export type ExceptionStatus = z.infer<typeof exceptionStatusSchema>;
export type ExceptionType = z.infer<typeof exceptionTypeSchema>;
export type ToleranceCreateInput = z.infer<typeof toleranceCreateSchema>;
export type ToleranceUpdateInput = z.infer<typeof toleranceUpdateSchema>;
export type ToleranceListFilterInput = z.infer<typeof toleranceListFilterSchema>;
export type MatchingRequestInput = z.infer<typeof matchingRequestSchema>;
export type ExceptionListFilterInput = z.infer<typeof exceptionListFilterSchema>;
export type ExceptionReviewInput = z.infer<typeof exceptionReviewSchema>;
export type GRIRReportFilterInput = z.infer<typeof grirReportFilterSchema>;
