/**
 * Stability Program Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 */

import { z } from 'zod/v4';

// ============================================
// Enums
// ============================================

export const studyTypeSchema = z.enum(['long_term', 'accelerated', 'intermediate']);
export const protocolStatusSchema = z.enum(['draft', 'approved', 'obsolete']);
export const studyStatusSchema = z.enum(['active', 'completed', 'cancelled', 'on_hold']);
export const sampleStatusSchema = z.enum(['pending', 'sampled', 'tested', 'skipped']);

// ============================================
// Protocol Schemas
// ============================================

export const protocolCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  productId: z.number().int().positive('Product is required'),
  studyType: studyTypeSchema,
  storageCondition: z.string().min(1, 'Storage condition is required').max(100),
  timepoints: z
    .array(z.number().int().min(0))
    .min(1, 'At least one timepoint is required')
    .max(20),
  testsRequired: z
    .array(z.number().int().positive())
    .min(1, 'At least one test is required'),
});

export const protocolUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  storageCondition: z.string().min(1).max(100).optional(),
  timepoints: z.array(z.number().int().min(0)).min(1).max(20).optional(),
  testsRequired: z.array(z.number().int().positive()).min(1).optional(),
  status: z.enum(['draft', 'obsolete']).optional(),
});

export const protocolListParamsSchema = z.object({
  productId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  studyType: studyTypeSchema.optional(),
  status: protocolStatusSchema.optional(),
});

// ============================================
// Study Schemas
// ============================================

export const studyCreateSchema = z.object({
  protocolId: z.number().int().positive('Protocol is required'),
  lotId: z.number().int().positive('Lot is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  chamberLocation: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const studyUpdateSchema = z.object({
  status: studyStatusSchema.optional(),
  chamberLocation: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const studyListParamsSchema = z.object({
  protocolId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  productId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  status: studyStatusSchema.optional(),
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

// ============================================
// Sample Schemas
// ============================================

export const sampleUpdateSchema = z.object({
  status: sampleStatusSchema.optional(),
  actualDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const recordTestSchema = z.object({
  qualityTestId: z.number().int().positive('Quality test ID is required'),
  oosDetected: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export const sampleListParamsSchema = z.object({
  studyId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  status: sampleStatusSchema.optional(),
  dueSoon: z
    .string()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .optional(),
  overdue: z
    .string()
    .transform((v) => v === 'true')
    .pipe(z.boolean())
    .optional(),
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export const sampleAlertsParamsSchema = z.object({
  daysAhead: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(365))
    .optional(),
});

// ============================================
// Trends Schemas
// ============================================

export const trendsParamsSchema = z.object({
  productId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive())
    .optional(),
});

export const studyTrendsParamsSchema = z.object({
  parameter: z.string().max(100).optional(),
});

// ============================================
// Type Exports
// ============================================

export type ProtocolCreateInput = z.infer<typeof protocolCreateSchema>;
export type ProtocolUpdateInput = z.infer<typeof protocolUpdateSchema>;
export type ProtocolListParams = z.infer<typeof protocolListParamsSchema>;
export type StudyCreateInput = z.infer<typeof studyCreateSchema>;
export type StudyUpdateInput = z.infer<typeof studyUpdateSchema>;
export type StudyListParams = z.infer<typeof studyListParamsSchema>;
export type SampleUpdateInput = z.infer<typeof sampleUpdateSchema>;
export type RecordTestInput = z.infer<typeof recordTestSchema>;
export type SampleListParams = z.infer<typeof sampleListParamsSchema>;
export type SampleAlertsParams = z.infer<typeof sampleAlertsParamsSchema>;
export type TrendsParams = z.infer<typeof trendsParamsSchema>;
export type StudyTrendsParams = z.infer<typeof studyTrendsParamsSchema>;
