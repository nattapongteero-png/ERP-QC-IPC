/**
 * CAPA Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Zod schemas for validating CAPA API requests.
 * Enhanced for GMP Compliance: Risk Assessment, Impact Assessment, Approval Workflow, Attachments
 */

import { z } from 'zod/v4';

// ============================================
// Base Enums
// ============================================

export const capaSourceTypeSchema = z.enum(['deviation', 'complaint', 'audit_finding', 'other']);
export const capaTypeSchema = z.enum(['corrective', 'preventive', 'both']);
export const capaPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const capaStatusSchema = z.enum(['open', 'investigation', 'action_pending', 'verification', 'pending_approval', 'closed', 'cancelled']);
export const capaActionTypeSchema = z.enum(['immediate', 'corrective', 'preventive']);
export const capaActionStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'overdue']);
export const capaEffectivenessResultSchema = z.enum(['effective', 'not_effective', 'partial']);

// Phase 1 Critical: Risk Assessment Enums (ICH Q9)
export const riskSeveritySchema = z.enum(['negligible', 'minor', 'moderate', 'major', 'critical']);
export const riskProbabilitySchema = z.enum(['rare', 'unlikely', 'possible', 'likely', 'certain']);

// Phase 1 Critical: Impact Assessment Enums
export const impactScopeSchema = z.enum(['single_batch', 'multiple_batches', 'product_line', 'facility', 'multi_site']);

// Phase 1 Critical: Approval Workflow Enums
export const approvalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'revision_required']);
export const approvalRoleSchema = z.enum(['owner', 'qa_reviewer', 'qa_manager', 'plant_manager']);

// Phase 1 Critical: Attachment Type Enums
export const attachmentTypeSchema = z.enum(['evidence', 'root_cause_report', 'investigation_report', 'sop_revision', 'training_record', 'photo', 'lab_result', 'other']);

// ============================================
// CAPA CRUD Schemas
// ============================================

// Create CAPA schema
export const capaCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  sourceType: capaSourceTypeSchema,
  sourceId: z.number().int().positive().optional(),
  type: capaTypeSchema,
  priority: capaPrioritySchema,
  ownerId: z.number().int().positive('Owner is required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  rootCauseAnalysis: z.string().max(5000).optional(),
  rootCauseCategory: z.string().max(255).optional(),

  // Phase 1 Critical: Risk Assessment (ICH Q9)
  riskSeverity: riskSeveritySchema.optional(),
  riskProbability: riskProbabilitySchema.optional(),
  riskJustification: z.string().max(2000).optional(),

  // Phase 1 Critical: Impact Assessment
  impactScope: impactScopeSchema.optional(),
  affectedProducts: z.array(z.string()).optional(),
  affectedBatches: z.array(z.string()).optional(),
  affectedProcesses: z.array(z.string()).optional(),
  patientImpact: z.boolean().optional().default(false),
  regulatoryNotificationRequired: z.boolean().optional().default(false),
});

// Update CAPA schema
export const capaUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  priority: capaPrioritySchema.optional(),
  status: capaStatusSchema.optional(),
  rootCauseAnalysis: z.string().max(5000).optional(),
  rootCauseCategory: z.string().max(255).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  ownerId: z.number().int().positive().optional(),

  // Phase 1 Critical: Risk Assessment (ICH Q9)
  riskSeverity: riskSeveritySchema.optional(),
  riskProbability: riskProbabilitySchema.optional(),
  riskJustification: z.string().max(2000).optional(),

  // Phase 1 Critical: Impact Assessment
  impactScope: impactScopeSchema.optional(),
  affectedProducts: z.array(z.string()).optional(),
  affectedBatches: z.array(z.string()).optional(),
  affectedProcesses: z.array(z.string()).optional(),
  patientImpact: z.boolean().optional(),
  regulatoryNotificationRequired: z.boolean().optional(),
  regulatoryNotificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  regulatoryReferenceNumber: z.string().max(100).optional(),
});

// Close CAPA schema (deprecated - use submit for approval instead)
export const capaCloseSchema = z.object({
  closureNotes: z.string().max(2000).optional(),
});

// Create CAPA from deviation schema
export const capaFromDeviationSchema = z.object({
  deviationId: z.number().int().positive('Deviation ID is required'),
  title: z.string().min(1, 'Title is required').max(500),
  type: capaTypeSchema,
  priority: capaPrioritySchema,
  ownerId: z.number().int().positive('Owner is required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  rootCauseAnalysis: z.string().max(5000).optional(),
  rootCauseCategory: z.string().max(255).optional(),
});

// Create action schema
export const capaActionCreateSchema = z.object({
  description: z.string().min(1, 'Description is required').max(2000),
  actionType: capaActionTypeSchema,
  assigneeId: z.number().int().positive('Assignee is required'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
});

// Update action schema
export const capaActionUpdateSchema = z.object({
  status: capaActionStatusSchema.optional(),
  completionNotes: z.string().max(2000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});

// Effectiveness check schema
export const capaEffectivenessCreateSchema = z.object({
  checkDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  criteria: z.string().min(1, 'Criteria is required').max(1000),
  result: capaEffectivenessResultSchema,
  evidence: z.string().max(2000).optional(),
  followUpRequired: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional(),
});

// List parameters schema
export const capaListParamsSchema = z.object({
  status: capaStatusSchema.optional(),
  type: capaTypeSchema.optional(),
  priority: capaPrioritySchema.optional(),
  sourceType: capaSourceTypeSchema.optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(1000).optional().default(20),
});

// ============================================
// Phase 1 Critical: Attachment Schemas
// ============================================

// Create attachment schema (metadata only - file upload handled separately)
export const capaAttachmentCreateSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(255),
  originalName: z.string().min(1, 'Original file name is required').max(255),
  fileSize: z.number().int().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required').max(100),
  attachmentType: attachmentTypeSchema,
  description: z.string().max(1000).optional(),
});

// ============================================
// Phase 1 Critical: Approval Workflow Schemas
// ============================================

// Submit for approval schema
export const capaSubmitForApprovalSchema = z.object({
  closureNotes: z.string().max(2000).optional(),
});

// Approval action schema (approve/reject/request revision)
export const capaApprovalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_revision']),
  comments: z.string().max(2000).optional(),
  signaturePassword: z.string().min(1, 'Password is required for electronic signature'),
});

// Create approval step schema (admin only)
export const capaApprovalCreateSchema = z.object({
  approverRole: approvalRoleSchema,
  approverId: z.number().int().positive().optional(),
});

// ============================================
// Type Exports
// ============================================

export type CapaCreateInput = z.infer<typeof capaCreateSchema>;
export type CapaUpdateInput = z.infer<typeof capaUpdateSchema>;
export type CapaCloseInput = z.infer<typeof capaCloseSchema>;
export type CapaFromDeviationInput = z.infer<typeof capaFromDeviationSchema>;
export type CapaActionCreateInput = z.infer<typeof capaActionCreateSchema>;
export type CapaActionUpdateInput = z.infer<typeof capaActionUpdateSchema>;
export type CapaEffectivenessCreateInput = z.infer<typeof capaEffectivenessCreateSchema>;
export type CapaListParamsInput = z.infer<typeof capaListParamsSchema>;

// Phase 1 Critical: New type exports
export type CapaAttachmentCreateInput = z.infer<typeof capaAttachmentCreateSchema>;
export type CapaSubmitForApprovalInput = z.infer<typeof capaSubmitForApprovalSchema>;
export type CapaApprovalActionInput = z.infer<typeof capaApprovalActionSchema>;
export type CapaApprovalCreateInput = z.infer<typeof capaApprovalCreateSchema>;
