/**
 * Document Control Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * Zod schemas for validating document control inputs
 */

import { z } from 'zod';

// Document status enum
export const documentStatusSchema = z.enum(['draft', 'active', 'obsolete', 'archived']);

// Document version status enum
export const documentVersionStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'superseded',
]);

// Approval decision enum
export const approvalDecisionSchema = z.enum(['approved', 'rejected']);

// Document create schema
export const documentCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  typeId: z.number().int().positive('Document type is required'),
  departmentId: z.number().int().positive().optional().nullable(),
  content: z.string().optional(),
  retentionYears: z.number().int().positive().max(99).default(5),
});

// Document update schema
export const documentUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  departmentId: z.number().int().positive().optional().nullable(),
  status: documentStatusSchema.optional(),
});

// Version create schema
export const versionCreateSchema = z.object({
  content: z.string().optional(),
  filePath: z.string().max(500).optional(), // Legacy - deprecated, kept for backwards compatibility
  // BLOB storage fields (stored in database)
  fileData: z.string().optional(), // Base64-encoded file data
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024).optional(), // Max 10MB
  mimeType: z.string().max(100).optional(),
  changeDescription: z.string().max(1000).optional(),
  isMajorRevision: z.boolean().default(false),
});

// Submit for approval schema
export const submitApprovalSchema = z.object({
  versionId: z.number().int().positive('Version ID is required'),
  approvers: z
    .array(z.number().int().positive())
    .min(1, 'At least one approver is required'),
});

// Approval decision schema
export const approvalDecisionInputSchema = z.object({
  decision: approvalDecisionSchema,
  comments: z.string().max(2000).optional(),
}).refine(
  (data) => data.decision !== 'rejected' || (data.comments && data.comments.length > 0),
  {
    message: 'Comments are required when rejecting a document',
    path: ['comments'],
  }
);

// Obsolete document schema
export const obsoleteDocumentSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(1000),
});

// List query params schema
export const documentListQuerySchema = z.object({
  status: documentStatusSchema.optional(),
  typeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
});

// Export types
export type DocumentCreate = z.infer<typeof documentCreateSchema>;
export type DocumentUpdate = z.infer<typeof documentUpdateSchema>;
export type VersionCreate = z.infer<typeof versionCreateSchema>;
export type SubmitApproval = z.infer<typeof submitApprovalSchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionInputSchema>;
export type ObsoleteDocument = z.infer<typeof obsoleteDocumentSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
