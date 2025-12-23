/**
 * Change Control Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Zod schemas for validating Change Control API requests.
 */

import { z } from 'zod/v4';

// ============================================
// Base Enums
// ============================================

export const changeTypeSchema = z.enum(['process', 'equipment', 'document', 'supplier', 'formula', 'other']);
export const changePrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export const changeStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'implemented', 'closed']);
export const approvalRoleSchema = z.enum(['qa', 'production', 'regulatory', 'management']);
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected']);

// ============================================
// Change Request CRUD Schemas
// ============================================

// Create change request schema
export const changeRequestCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  changeType: changeTypeSchema,
  description: z.string().max(5000).optional(),
  justification: z.string().max(2000).optional(),
  impactAssessment: z.string().max(2000).optional(),
  riskAssessment: z.string().max(2000).optional(),
  priority: changePrioritySchema.optional().default('medium'),
  ownerId: z.number().int().positive('Owner is required'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
});

// Update change request schema
export const changeRequestUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  justification: z.string().max(2000).optional(),
  impactAssessment: z.string().max(2000).optional(),
  riskAssessment: z.string().max(2000).optional(),
  priority: changePrioritySchema.optional(),
  ownerId: z.number().int().positive().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});

// List parameters schema
export const changeRequestListParamsSchema = z.object({
  status: changeStatusSchema.optional(),
  changeType: changeTypeSchema.optional(),
  priority: changePrioritySchema.optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000).optional().default(20),
});

// ============================================
// Approval Workflow Schemas
// ============================================

// Approve/Reject change schema
export const changeApprovalActionSchema = z.object({
  role: approvalRoleSchema,
  approved: z.boolean(),
  comments: z.string().max(2000).optional(),
});

// Implement change schema
export const changeImplementSchema = z.object({
  implementationNotes: z.string().max(2000).optional(),
});

// Close change schema
export const changeCloseSchema = z.object({
  closureNotes: z.string().max(2000).optional(),
});

// ============================================
// Type Exports
// ============================================

export type ChangeRequestCreateInput = z.infer<typeof changeRequestCreateSchema>;
export type ChangeRequestUpdateInput = z.infer<typeof changeRequestUpdateSchema>;
export type ChangeRequestListParamsInput = z.infer<typeof changeRequestListParamsSchema>;
export type ChangeApprovalActionInput = z.infer<typeof changeApprovalActionSchema>;
export type ChangeImplementInput = z.infer<typeof changeImplementSchema>;
export type ChangeCloseInput = z.infer<typeof changeCloseSchema>;
