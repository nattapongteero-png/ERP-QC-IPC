/**
 * Purchase Requisition Zod Validation Schemas (T032)
 * Part of 011-accounting-spec-gap
 */

import { z } from 'zod';

/**
 * PR Status Enum
 */
export const prStatusSchema = z.enum([
  'draft',
  'submitted',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled',
  'converted',
]);

/**
 * Priority Enum
 */
export const prPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

/**
 * Line Status Enum
 */
export const prLineStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'partial_po',
  'full_po',
]);

/**
 * PR Create Schema
 */
export const prCreateSchema = z.object({
  requesterId: z.number().int().positive('Requester ID is required'),
  departmentId: z.number().int().positive().optional(),
  priority: prPrioritySchema.optional().default('normal'),
  requiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  description: z.string().max(500).optional(),
  justification: z.string().max(1000).optional(),
  costCenterId: z.number().int().positive().optional(),
  projectId: z.number().int().positive().optional(),
});

/**
 * PR Update Schema
 */
export const prUpdateSchema = z.object({
  priority: prPrioritySchema.optional(),
  requiredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  justification: z.string().max(1000).optional().nullable(),
  costCenterId: z.number().int().positive().optional().nullable(),
  projectId: z.number().int().positive().optional().nullable(),
});

/**
 * PR Line Create Schema
 */
export const prLineCreateSchema = z.object({
  itemId: z.number().int().positive().optional(),
  itemCode: z.string().max(50).optional(),
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.number().positive('Quantity must be positive'),
  unitOfMeasure: z.string().min(1, 'Unit of measure is required').max(20),
  estimatedUnitPrice: z.number().min(0).optional().default(0),
  suggestedVendorId: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * PR Lines Batch Create Schema
 */
export const prLinesCreateSchema = z.object({
  lines: z.array(prLineCreateSchema).min(1, 'At least one line is required'),
});

/**
 * PR Line Update Schema
 */
export const prLineUpdateSchema = z.object({
  itemId: z.number().int().positive().optional().nullable(),
  itemCode: z.string().max(50).optional().nullable(),
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().positive().optional(),
  unitOfMeasure: z.string().min(1).max(20).optional(),
  estimatedUnitPrice: z.number().min(0).optional(),
  suggestedVendorId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * PR Submit Schema
 */
export const prSubmitSchema = z.object({
  prId: z.number().int().positive('PR ID is required'),
});

/**
 * PR Approval Schema
 */
export const prApprovalSchema = z.object({
  action: z.enum(['approve', 'reject']),
  comments: z.string().max(1000).optional(),
  lineApprovals: z.array(z.object({
    lineId: z.number().int().positive(),
    approved: z.boolean(),
    comments: z.string().max(500).optional(),
  })).optional(),
});

/**
 * PR to PO Convert Schema
 */
export const prToPOConvertSchema = z.object({
  prId: z.number().int().positive('PR ID is required'),
  lineIds: z.array(z.number().int().positive()).optional(),
  vendorId: z.number().int().positive('Vendor ID is required'),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  deliveryAddress: z.string().max(500).optional(),
  paymentTerms: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * PR List Filter Schema
 */
export const prListFilterSchema = z.object({
  status: prStatusSchema.optional(),
  priority: prPrioritySchema.optional(),
  requesterId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// Export types
export type PRCreateInput = z.infer<typeof prCreateSchema>;
export type PRUpdateInput = z.infer<typeof prUpdateSchema>;
export type PRLineCreateInput = z.infer<typeof prLineCreateSchema>;
export type PRLineUpdateInput = z.infer<typeof prLineUpdateSchema>;
export type PRSubmitInput = z.infer<typeof prSubmitSchema>;
export type PRApprovalInput = z.infer<typeof prApprovalSchema>;
export type PRToPOConvertInput = z.infer<typeof prToPOConvertSchema>;
export type PRListFilterInput = z.infer<typeof prListFilterSchema>;
