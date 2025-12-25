/**
 * Manufacturing Contracts Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 */

import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const contractorTypeEnum = z.enum(['manufacturer', 'laboratory', 'both']);
export const contractStatusEnum = z.enum(['active', 'expired', 'terminated', 'pending']);
export const activityTypeEnum = z.enum(['manufacturing', 'testing', 'packaging']);

// ============================================
// Contract Schemas
// ============================================

export const contractCreateSchema = z.object({
  contractorName: z.string().min(1, 'Contractor name is required').max(200),
  contractorType: contractorTypeEnum,
  scope: z.string().max(2000).optional(),
  effectiveDate: z.string().optional(),
  expirationDate: z.string().optional(),
  qualityAgreementPath: z.string().max(500).optional(),
  contactPerson: z.string().max(200).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

export const contractUpdateSchema = z.object({
  contractorName: z.string().min(1).max(200).optional(),
  contractorType: contractorTypeEnum.optional(),
  scope: z.string().max(2000).optional(),
  effectiveDate: z.string().optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  status: contractStatusEnum.optional(),
  qualityAgreementPath: z.string().max(500).optional().nullable(),
  lastAuditDate: z.string().optional().nullable(),
  nextAuditDue: z.string().optional().nullable(),
  contactPerson: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().or(z.literal('')).nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const contractListParamsSchema = z.object({
  status: contractStatusEnum.optional(),
  contractorType: contractorTypeEnum.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ============================================
// Contract Batch Schemas
// ============================================

export const batchCreateSchema = z.object({
  contractId: z.coerce.number().int().positive(),
  lotId: z.coerce.number().int().positive().optional(),
  activityType: activityTypeEnum,
  activityDescription: z.string().max(2000).optional(),
  performedDate: z.string().optional(),
  certificatePath: z.string().max(500).optional(),
});

export const batchUpdateSchema = z.object({
  lotId: z.coerce.number().int().positive().optional().nullable(),
  activityType: activityTypeEnum.optional(),
  activityDescription: z.string().max(2000).optional().nullable(),
  performedDate: z.string().optional().nullable(),
  certificatePath: z.string().max(500).optional().nullable(),
  verifiedBy: z.coerce.number().int().positive().optional().nullable(),
});

export const batchListParamsSchema = z.object({
  contractId: z.coerce.number().int().positive().optional(),
  activityType: activityTypeEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ============================================
// Type Exports
// ============================================

export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
export type ContractListParamsInput = z.infer<typeof contractListParamsSchema>;
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;
export type BatchListParamsInput = z.infer<typeof batchListParamsSchema>;
