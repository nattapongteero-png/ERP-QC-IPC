/**
 * Material Return Validation Schemas
 *
 * Validates payloads for the Material Return module:
 * - Operator submits a return (one return event = one or more lines)
 * - QA approves or rejects
 *
 * Standards: FDA 21 CFR 211.103 (yield reconciliation), PIC/S PE 009 Annex 7
 */

import { z } from 'zod';

export const varianceReasonSchema = z.enum([
  'process_loss',
  'sampling',
  'spillage',
  'cleaning',
  'measurement_error',
  'unaccounted',
  'other',
]);

export const materialReturnLineInputSchema = z
  .object({
    sourceLotId: z.number().int().positive('sourceLotId must be a positive integer'),
    itemId: z.number().int().positive('itemId must be a positive integer'),
    issuedQty: z.number().positive('issuedQty must be > 0'),
    issuedUnit: z.string().min(1, 'issuedUnit is required').max(20),
    usedQty: z.number().min(0, 'usedQty must be >= 0'),
    usedUnit: z.string().min(1, 'usedUnit is required').max(20),
    returnQty: z.number().min(0, 'returnQty must be >= 0'),
    returnUnit: z.string().min(1, 'returnUnit is required').max(20),
    expectedVarianceQty: z.number().nullable().optional(),
    varianceReason: varianceReasonSchema,
    varianceExplanation: z.string().max(2000).nullable().optional(),
    containerLabel: z.string().min(1, 'containerLabel is required').max(50),
    containerType: z.string().max(50).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  // Cross-field rules: usedQty <= issuedQty AND returnQty <= issuedQty - usedQty.
  // The variance bucket itself is automatic — operator only declares the
  // reason for whatever residual remains.
  .refine((line) => line.usedQty <= line.issuedQty, {
    message: 'usedQty cannot exceed issuedQty',
    path: ['usedQty'],
  })
  .refine((line) => line.returnQty <= line.issuedQty - line.usedQty + 1e-6, {
    // 1e-6 tolerance for floating-point noise on operator-entered decimals.
    message: 'returnQty cannot exceed issuedQty - usedQty',
    path: ['returnQty'],
  });

export const submitMaterialReturnSchema = z.object({
  workOrderId: z.number().int().positive('workOrderId is required'),
  receivingWarehouseId: z.number().int().positive('receivingWarehouseId is required'),
  operatorId: z.number().int().positive('operatorId is required'),
  notes: z.string().max(2000).nullable().optional(),
  lines: z
    .array(materialReturnLineInputSchema)
    .min(1, 'At least one return line is required'),
});

export const approveActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel-approval']),
  reason: z.string().max(2000).nullable().optional(),
});

// Update existing material return — used while still in 'submitted' status
// before QA confirms the receipt. workOrderId/operatorId are immutable so they
// are not part of the payload; only line content + container info can change.
export const updateMaterialReturnSchema = z.object({
  receivingWarehouseId: z.number().int().positive().optional(),
  notes: z.string().max(2000).nullable().optional(),
  lines: z
    .array(materialReturnLineInputSchema)
    .min(1, 'At least one return line is required'),
});

// Type exports for service-layer consumption
export type SubmitMaterialReturnInput = z.infer<typeof submitMaterialReturnSchema>;
export type UpdateMaterialReturnInput = z.infer<typeof updateMaterialReturnSchema>;
export type MaterialReturnLineInput = z.infer<typeof materialReturnLineInputSchema>;
export type ApproveActionInput = z.infer<typeof approveActionSchema>;
export type VarianceReason = z.infer<typeof varianceReasonSchema>;
