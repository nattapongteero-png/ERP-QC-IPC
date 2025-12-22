/**
 * Recall Validation Schemas
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * Zod validation schemas for recall API requests.
 */

import { z } from 'zod/v4';

// ============================================
// Enums
// ============================================

export const recallClassSchema = z.enum(['class_i', 'class_ii', 'class_iii']);

export const recallStatusSchema = z.enum(['initiated', 'in_progress', 'completed', 'closed']);

export const notificationMethodSchema = z.enum(['phone', 'email', 'fax', 'courier']);

export const notificationResponseStatusSchema = z.enum([
  'pending',
  'acknowledged',
  'returning',
  'returned',
  'unresponsive',
]);

// ============================================
// Recall Schemas
// ============================================

export const recallCreateSchema = z.object({
  recallClass: recallClassSchema,
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  productId: z.number().int().positive('Product ID is required'),
  affectedLots: z.array(z.number().int().positive()).min(1, 'At least one lot must be specified'),
  coordinatorId: z.number().int().positive('Coordinator ID is required'),
  complaintId: z.number().int().positive().optional(),
});

export const recallUpdateSchema = z.object({
  status: recallStatusSchema.optional(),
  regulatoryReportDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

export const recallCloseSchema = z.object({
  effectivenessAssessment: z.string().optional(),
  regulatoryReportPath: z.string().optional(),
});

// ============================================
// Notification Schemas
// ============================================

export const recallNotificationCreateSchema = z.object({
  customerId: z.number().int().positive('Customer ID is required'),
  notificationMethod: notificationMethodSchema,
  notes: z.string().optional(),
});

export const recallNotificationUpdateSchema = z.object({
  responseStatus: notificationResponseStatusSchema.optional(),
  quantityReturned: z.number().min(0).optional(),
  notes: z.string().optional(),
});

// ============================================
// Reconciliation Schemas
// ============================================

export const recallReconciliationCreateSchema = z.object({
  lotId: z.number().int().positive('Lot ID is required'),
  returnedQty: z.number().min(0).optional(),
  destroyedQty: z.number().min(0).optional(),
  accountedQty: z.number().min(0).optional(),
  reconciliationNotes: z.string().optional(),
});

// ============================================
// Mock Drill Schema
// ============================================

export const mockDrillRequestSchema = z.object({
  lotId: z.number().int().positive('Lot ID is required'),
  drillName: z.string().optional(),
});

// ============================================
// List/Query Schemas
// ============================================

export const recallListParamsSchema = z.object({
  status: recallStatusSchema.optional(),
  recallClass: recallClassSchema.optional(),
  productId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Type Exports
// ============================================

export type RecallCreateInput = z.infer<typeof recallCreateSchema>;
export type RecallUpdateInput = z.infer<typeof recallUpdateSchema>;
export type RecallCloseInput = z.infer<typeof recallCloseSchema>;
export type RecallNotificationCreateInput = z.infer<typeof recallNotificationCreateSchema>;
export type RecallNotificationUpdateInput = z.infer<typeof recallNotificationUpdateSchema>;
export type RecallReconciliationCreateInput = z.infer<typeof recallReconciliationCreateSchema>;
export type MockDrillRequestInput = z.infer<typeof mockDrillRequestSchema>;
export type RecallListParamsInput = z.infer<typeof recallListParamsSchema>;
