/**
 * Complaint Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Zod schemas for validating Complaint API requests.
 */

import { z } from 'zod/v4';

// Enums for Complaint validation
export const complaintSourceSchema = z.enum(['customer', 'distributor', 'regulatory', 'internal']);
export const complaintCategorySchema = z.enum(['quality', 'efficacy', 'safety', 'packaging', 'labeling', 'other']);
export const complaintSeveritySchema = z.enum(['minor', 'major', 'critical']);
export const complaintStatusSchema = z.enum(['received', 'under_investigation', 'resolved', 'closed']);
export const complaintTrendsPeriodSchema = z.enum(['month', 'quarter', 'year']);
export const complaintTrendsGroupBySchema = z.enum(['category', 'product', 'severity']);

// Create Complaint schema
export const complaintCreateSchema = z.object({
  receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  source: complaintSourceSchema,
  customerName: z.string().max(255).optional(),
  customerContact: z.string().max(500).optional(),
  productId: z.number().int().positive('Product is required'),
  lotId: z.number().int().positive().optional(),
  category: complaintCategorySchema,
  severity: complaintSeveritySchema,
  description: z.string().min(1, 'Description is required').max(5000),
});

// Update Complaint schema
export const complaintUpdateSchema = z.object({
  status: complaintStatusSchema.optional(),
  severity: complaintSeveritySchema.optional(),
  regulatoryReportRequired: z.boolean().optional(),
  regulatoryReportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').nullable().optional(),
});

// Close Complaint schema
export const complaintCloseSchema = z.object({
  closureNotes: z.string().max(2000).optional(),
});

// Investigation schema
export const complaintInvestigationCreateSchema = z.object({
  batchRecordReview: z.string().max(2000).optional(),
  retainSampleTest: z.string().max(2000).optional(),
  rootCause: z.string().min(1, 'Root cause is required').max(5000),
  conclusion: z.string().min(1, 'Conclusion is required').max(5000),
  recommendation: z.string().max(2000).optional(),
});

// Route to QC schema
export const complaintRouteToQCSchema = z.object({
  investigatorId: z.number().int().positive('Investigator is required'),
});

// Link CAPA schema
export const complaintLinkCapaSchema = z.object({
  capaId: z.number().int().positive('CAPA ID is required'),
});

// List parameters schema
export const complaintListParamsSchema = z.object({
  status: complaintStatusSchema.optional(),
  category: complaintCategorySchema.optional(),
  severity: complaintSeveritySchema.optional(),
  productId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000).optional().default(20),
});

// Trends parameters schema
export const complaintTrendsParamsSchema = z.object({
  period: complaintTrendsPeriodSchema.optional().default('month'),
  groupBy: complaintTrendsGroupBySchema.optional().default('category'),
});

// Adverse Event schemas
export const adverseEventSeveritySchema = z.enum(['mild', 'moderate', 'severe', 'life_threatening', 'fatal']);

export const adverseEventCreateSchema = z.object({
  eventType: z.string().min(1, 'Event type is required').max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  severity: adverseEventSeveritySchema,
  description: z.string().min(1, 'Description is required').max(5000),
  patientOutcome: z.string().max(1000).optional(),
});

// Type exports
export type ComplaintCreateInput = z.infer<typeof complaintCreateSchema>;
export type ComplaintUpdateInput = z.infer<typeof complaintUpdateSchema>;
export type ComplaintCloseInput = z.infer<typeof complaintCloseSchema>;
export type ComplaintInvestigationCreateInput = z.infer<typeof complaintInvestigationCreateSchema>;
export type ComplaintRouteToQCInput = z.infer<typeof complaintRouteToQCSchema>;
export type ComplaintLinkCapaInput = z.infer<typeof complaintLinkCapaSchema>;
export type ComplaintListParamsInput = z.infer<typeof complaintListParamsSchema>;
export type ComplaintTrendsParamsInput = z.infer<typeof complaintTrendsParamsSchema>;
export type AdverseEventCreateInput = z.infer<typeof adverseEventCreateSchema>;
