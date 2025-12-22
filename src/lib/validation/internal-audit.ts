/**
 * Internal Audit Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 */

import { z } from 'zod/v4';

// ============================================
// Common Enums
// ============================================

export const auditPlanStatusSchema = z.enum(['draft', 'approved', 'in_progress', 'completed']);
export const auditTypeSchema = z.enum(['internal', 'external', 'regulatory']);
export const auditStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);
export const auditFindingCategorySchema = z.enum(['observation', 'minor', 'major', 'critical']);
export const auditFindingStatusSchema = z.enum(['open', 'capa_assigned', 'closed']);

// ============================================
// Audit Plan Schemas
// ============================================

export const planCreateSchema = z.object({
  planYear: z.number().int().min(2020).max(2100),
  name: z.string().min(1, 'Name is required').max(200),
});

export const planUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'in_progress', 'completed']).optional(),
});

export const planListParamsSchema = z.object({
  year: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().optional()
  ),
  status: auditPlanStatusSchema.optional(),
});

// ============================================
// Audit Schemas
// ============================================

export const auditCreateSchema = z.object({
  planId: z.number().int().positive().optional(),
  auditType: auditTypeSchema,
  scope: z.string().min(1, 'Scope is required').max(1000),
  gmpChapters: z.array(z.number().int().min(1).max(10)).min(1, 'Select at least one GMP chapter'),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  leadAuditorId: z.number().int().positive('Lead auditor is required'),
  auditTeam: z.array(z.number().int().positive()).optional(),
});

export const auditUpdateSchema = z.object({
  scope: z.string().min(1).max(1000).optional(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  leadAuditorId: z.number().int().positive().optional(),
  auditTeam: z.array(z.number().int().positive()).optional(),
  status: z.enum(['scheduled', 'in_progress', 'cancelled']).optional(),
});

export const auditCompleteSchema = z.object({
  summary: z.string().max(2000).optional(),
  reportPath: z.string().max(500).optional(),
});

export const auditListParamsSchema = z.object({
  planId: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().optional()
  ),
  auditType: auditTypeSchema.optional(),
  status: auditStatusSchema.optional(),
  gmpChapter: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().min(1).max(10).optional()
  ),
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
// Finding Schemas
// ============================================

export const findingCreateSchema = z.object({
  auditId: z.number().int().positive('Audit ID is required'),
  category: auditFindingCategorySchema,
  gmpChapter: z.number().int().min(1).max(10),
  gmpRequirement: z.string().max(500).optional(),
  description: z.string().min(1, 'Description is required').max(2000),
  evidence: z.string().max(2000).optional(),
  areaOwner: z.number().int().positive().optional(),
  capaRequired: z.boolean().optional().default(false),
});

export const findingUpdateSchema = z.object({
  category: auditFindingCategorySchema.optional(),
  description: z.string().min(1).max(2000).optional(),
  evidence: z.string().max(2000).optional(),
  areaOwner: z.number().int().positive().optional(),
  capaRequired: z.boolean().optional(),
});

export const findingListParamsSchema = z.object({
  auditId: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().positive().optional()
  ),
  category: auditFindingCategorySchema.optional(),
  gmpChapter: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().int().min(1).max(10).optional()
  ),
  status: auditFindingStatusSchema.optional(),
  page: z.preprocess(
    (val) => (val ? Number(val) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (val) => (val ? Number(val) : 20),
    z.number().int().min(1).max(100).default(20)
  ),
});

export const assignCapaSchema = z.object({
  capaId: z.number().int().positive('CAPA ID is required'),
});

// ============================================
// Statistics Schemas
// ============================================

export const statisticsParamsSchema = z.object({
  year: z.preprocess(
    (val) => (val ? Number(val) : new Date().getFullYear()),
    z.number().int().min(2020).max(2100).default(new Date().getFullYear())
  ),
});

// ============================================
// Type Exports
// ============================================

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
export type PlanListParams = z.infer<typeof planListParamsSchema>;
export type AuditCreateInput = z.infer<typeof auditCreateSchema>;
export type AuditUpdateInput = z.infer<typeof auditUpdateSchema>;
export type AuditCompleteInput = z.infer<typeof auditCompleteSchema>;
export type AuditListParams = z.infer<typeof auditListParamsSchema>;
export type FindingCreateInput = z.infer<typeof findingCreateSchema>;
export type FindingUpdateInput = z.infer<typeof findingUpdateSchema>;
export type FindingListParams = z.infer<typeof findingListParamsSchema>;
export type AssignCapaInput = z.infer<typeof assignCapaSchema>;
export type StatisticsParams = z.infer<typeof statisticsParamsSchema>;
