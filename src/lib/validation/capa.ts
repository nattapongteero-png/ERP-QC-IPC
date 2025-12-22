/**
 * CAPA Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Zod schemas for validating CAPA API requests.
 */

import { z } from 'zod/v4';

// Enums for CAPA validation
export const capaSourceTypeSchema = z.enum(['deviation', 'complaint', 'audit_finding', 'other']);
export const capaTypeSchema = z.enum(['corrective', 'preventive', 'both']);
export const capaPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const capaStatusSchema = z.enum(['open', 'investigation', 'action_pending', 'verification', 'closed', 'cancelled']);
export const capaActionTypeSchema = z.enum(['immediate', 'corrective', 'preventive']);
export const capaActionStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'overdue']);
export const capaEffectivenessResultSchema = z.enum(['effective', 'not_effective', 'partial']);

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
});

// Close CAPA schema
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
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// Type exports
export type CapaCreateInput = z.infer<typeof capaCreateSchema>;
export type CapaUpdateInput = z.infer<typeof capaUpdateSchema>;
export type CapaCloseInput = z.infer<typeof capaCloseSchema>;
export type CapaFromDeviationInput = z.infer<typeof capaFromDeviationSchema>;
export type CapaActionCreateInput = z.infer<typeof capaActionCreateSchema>;
export type CapaActionUpdateInput = z.infer<typeof capaActionUpdateSchema>;
export type CapaEffectivenessCreateInput = z.infer<typeof capaEffectivenessCreateSchema>;
export type CapaListParamsInput = z.infer<typeof capaListParamsSchema>;
