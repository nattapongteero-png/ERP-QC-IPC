/**
 * COA Validation Schemas
 *
 * Validates payloads for the COA module:
 * - Generate COA from a released QC sample (POST /api/quality/coa)
 * - Status transitions (draft → review → approved → issued, plus supersede/revoke)
 * - Template CRUD
 * - PDF print logging
 *
 * Standards: ISO/IEC 17025, FDA 21 CFR Part 11, WHO TRS 1010 Annex 4
 */

import { z } from 'zod';

// COA lifecycle states (see qc-coa-design.md §4.2)
export const coaStatusSchema = z.enum([
  'draft',
  'review',
  'approved',
  'issued',
  'superseded',
  'revoked',
]);

// COA conclusion (overall result vs spec)
export const coaConclusionSchema = z.enum([
  'complies',
  'does_not_comply',
  'partial',
]);

// COA test conclusion (per-test pass/fail mapped to conform/non-conform)
export const coaTestConclusionSchema = z.enum([
  'conform',
  'non_conform',
  'na',
]);

// Language preferences
export const coaLanguageSchema = z.enum(['th', 'en', 'bilingual']);

// Print types (audit trail)
export const coaPrintTypeSchema = z.enum([
  'preview',
  'official',
  'reprint',
  'customer_email',
]);

// Status-transition action verbs
export const coaActionSchema = z.enum([
  'submit_for_review',
  'approve',
  'issue',
  'supersede',
  'revoke',
]);

// Signature roles for COA — typically 2 tiers (approver + qa_release).
export const coaSignatureRoleSchema = z.enum([
  'analyst',
  'qc_manager',
  'approver',
  'qa_release',
]);

// ----------------------------------------------------------------------------
// Generate COA from sample
// ----------------------------------------------------------------------------

export const generateCoaSchema = z.object({
  sampleId: z.number().int().positive('sampleId is required'),
  templateId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  salesOrderRef: z.string().max(50).optional(),
  language: coaLanguageSchema.optional(),
});

export type GenerateCoaInput = z.infer<typeof generateCoaSchema>;

// ----------------------------------------------------------------------------
// Transition COA status
// ----------------------------------------------------------------------------

export const transitionCoaStatusSchema = z.object({
  action: coaActionSchema,
  signatureMeaning: z.string().max(50).optional(),
  signatureRole: coaSignatureRoleSchema.optional(),
  notes: z.string().max(2000).optional(),
  // For supersede:
  supersededBy: z.number().int().positive().optional(),
  // For revoke:
  reason: z.string().max(2000).optional(),
});

export type TransitionCoaStatusInput = z.infer<typeof transitionCoaStatusSchema>;

// ----------------------------------------------------------------------------
// Template CRUD
// ----------------------------------------------------------------------------

export const createCoaTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  productCategory: z.string().max(50).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  headerLogoPath: z.string().max(500).nullable().optional(),
  headerHtml: z.string().max(20000).nullable().optional(),
  footerHtml: z.string().max(20000).nullable().optional(),
  signatoryRoles: z.array(z.string()).optional(),
  showStorageConditions: z.boolean().optional(),
  showExpiryDate: z.boolean().optional(),
  showRetestDate: z.boolean().optional(),
  showQrVerify: z.boolean().optional(),
  language: coaLanguageSchema.optional(),
});

export type CreateCoaTemplateInput = z.infer<typeof createCoaTemplateSchema>;

export const updateCoaTemplateSchema = createCoaTemplateSchema.partial();
export type UpdateCoaTemplateInput = z.infer<typeof updateCoaTemplateSchema>;

// ----------------------------------------------------------------------------
// Print history (audit logging)
// ----------------------------------------------------------------------------

export const logCoaPrintSchema = z.object({
  printType: coaPrintTypeSchema,
  customerEmail: z.email().optional(),
});

export type LogCoaPrintInput = z.infer<typeof logCoaPrintSchema>;

// ----------------------------------------------------------------------------
// List filters
// ----------------------------------------------------------------------------

export const listCoaFiltersSchema = z.object({
  status: coaStatusSchema.optional(),
  productId: z.number().int().positive().optional(),
  customerId: z.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
});

export type ListCoaFilters = z.infer<typeof listCoaFiltersSchema>;

// Re-exported types for service layer
export type CoaStatus = z.infer<typeof coaStatusSchema>;
export type CoaConclusion = z.infer<typeof coaConclusionSchema>;
export type CoaTestConclusion = z.infer<typeof coaTestConclusionSchema>;
export type CoaLanguage = z.infer<typeof coaLanguageSchema>;
export type CoaAction = z.infer<typeof coaActionSchema>;
export type CoaPrintType = z.infer<typeof coaPrintTypeSchema>;
export type CoaSignatureRole = z.infer<typeof coaSignatureRoleSchema>;
