/**
 * Sanitation Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 */

import { z } from 'zod/v4';

// ============================================
// Common Enums
// ============================================

export const areaTypeSchema = z.enum(['production', 'warehouse', 'lab', 'office']);
export const sanitationFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly']);
export const sanitationLogStatusSchema = z.enum(['completed', 'partial', 'missed']);
export const pestControlServiceTypeSchema = z.enum(['routine', 'emergency', 'follow_up']);

// ============================================
// Sanitation Schedule Schemas
// ============================================

export const scheduleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  areaType: areaTypeSchema,
  areaId: z.number().int().positive().optional(),
  equipmentId: z.number().int().positive().optional(),
  frequency: sanitationFrequencySchema,
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  method: z.string().min(1, 'Method is required').max(500),
  verificationRequired: z.boolean().optional().default(true),
});

export const scheduleUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  method: z.string().min(1).max(500).optional(),
  verificationRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const scheduleListParamsSchema = z.object({
  areaType: areaTypeSchema.optional(),
  frequency: sanitationFrequencySchema.optional(),
  isActive: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional()
  ),
});

// ============================================
// Sanitation Log Schemas
// ============================================

export const logCreateSchema = z.object({
  scheduleId: z.number().int().positive('Schedule ID is required'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  performedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Performed date is required'),
  method: z.string().max(500).optional(),
  chemicalsUsed: z.string().max(500).optional(),
  status: sanitationLogStatusSchema,
  notes: z.string().max(1000).optional(),
});

export const logUpdateSchema = z.object({
  status: sanitationLogStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const logListParamsSchema = z.object({
  scheduleId: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().optional()
  ),
  areaType: areaTypeSchema.optional(),
  status: sanitationLogStatusSchema.optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 20),
    z.number().int().min(1).max(100).default(20)
  ),
});

// ============================================
// Pest Control Log Schemas
// ============================================

export const pestControlCreateSchema = z.object({
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Service date is required'),
  contractorName: z.string().min(1, 'Contractor name is required').max(200),
  technicianName: z.string().max(200).optional(),
  serviceType: pestControlServiceTypeSchema,
  areasServiced: z.array(z.string()).min(1, 'At least one area must be specified'),
  treatmentMethod: z.string().max(500).optional(),
  findingsCount: z.number().int().min(0).optional().default(0),
  findings: z.string().max(2000).optional(),
  recommendations: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional().default(false),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const pestControlUpdateSchema = z.object({
  findings: z.string().max(2000).optional(),
  recommendations: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

export const pestControlListParamsSchema = z.object({
  serviceType: pestControlServiceTypeSchema.optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 20),
    z.number().int().min(1).max(100).default(20)
  ),
});

// ============================================
// Trends Schemas
// ============================================

export const trendsParamsSchema = z.object({
  period: z.enum(['week', 'month', 'quarter', 'year']).optional().default('month'),
  areaType: areaTypeSchema.optional(),
});

// ============================================
// Type Exports
// ============================================

export type ScheduleCreateInput = z.infer<typeof scheduleCreateSchema>;
export type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;
export type ScheduleListParams = z.infer<typeof scheduleListParamsSchema>;
export type LogCreateInput = z.infer<typeof logCreateSchema>;
export type LogUpdateInput = z.infer<typeof logUpdateSchema>;
export type LogListParams = z.infer<typeof logListParamsSchema>;
export type PestControlCreateInput = z.infer<typeof pestControlCreateSchema>;
export type PestControlUpdateInput = z.infer<typeof pestControlUpdateSchema>;
export type PestControlListParams = z.infer<typeof pestControlListParamsSchema>;
export type TrendsParams = z.infer<typeof trendsParamsSchema>;
