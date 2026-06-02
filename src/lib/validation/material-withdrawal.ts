/**
 * Zod validation schemas for Material Withdrawal Approval (feature 018).
 *
 * Conditional rules:
 *   - reasonType=`other`              → reasonDetail required
 *   - reasonType=`machine_setup_loss` → machinePhase required
 */

import { z } from 'zod';
import {
  WITHDRAWAL_REASON_TYPES,
  WITHDRAWAL_APPROVAL_ACTIONS,
  MATERIAL_CATEGORIES,
} from '@/types/material-withdrawal';

// ---------------------------------------------------------------------------
// Create Request
// ---------------------------------------------------------------------------

export const withdrawalRequestItemSchema = z.object({
  materialId: z.number().int().positive(),
  quantityRequested: z.number().positive(),
  unit: z.string().trim().min(1).max(20),
});

export const createWithdrawalRequestSchema = z
  .object({
    workOrderId: z.number().int().positive(),
    items: z.array(withdrawalRequestItemSchema).min(1).max(20),
    reasonType: z.enum(WITHDRAWAL_REASON_TYPES),
    reasonDetail: z.string().trim().max(1000).optional(),
    machinePhase: z.string().trim().max(80).optional(),
    roomId: z.number().int().positive(),
    attachmentIds: z.array(z.number().int().positive()).max(5).optional(),
    factoryCode: z.string().trim().max(40).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reasonType === 'other') {
      if (!data.reasonDetail || data.reasonDetail.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reasonDetail'],
          message: 'reasonDetail is required when reasonType is "other"',
        });
      }
    }
    if (data.reasonType === 'machine_setup_loss') {
      if (!data.machinePhase || data.machinePhase.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['machinePhase'],
          message: 'machinePhase is required when reasonType is "machine_setup_loss"',
        });
      }
    }
  });

export type CreateWithdrawalRequestPayload = z.infer<typeof createWithdrawalRequestSchema>;

// ---------------------------------------------------------------------------
// Approve / Reject
// ---------------------------------------------------------------------------

export const approveWithdrawalRequestSchema = z.object({
  approvedItems: z
    .array(
      z.object({
        itemId: z.number().int().positive(),
        quantityApproved: z.number().min(0),
      }),
    )
    .optional(),
  comment: z.string().trim().max(1000).optional(),
  password: z.string().min(1),
});

export type ApproveWithdrawalRequestPayload = z.infer<typeof approveWithdrawalRequestSchema>;

export const rejectWithdrawalRequestSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  password: z.string().min(1),
});

export type RejectWithdrawalRequestPayload = z.infer<typeof rejectWithdrawalRequestSchema>;

// ---------------------------------------------------------------------------
// Cap Rules
// ---------------------------------------------------------------------------

export const createWithdrawalRuleSchema = z.object({
  factoryCode: z.string().trim().max(40).nullable().optional(),
  materialCategory: z.enum(MATERIAL_CATEGORIES).nullable().optional(),
  softCapPercent: z.number().min(0).max(999),
  hardCapPercent: z.number().min(0).max(999),
});

export type CreateWithdrawalRulePayload = z.infer<typeof createWithdrawalRuleSchema>;

export const updateWithdrawalRuleSchema = z.object({
  softCapPercent: z.number().min(0).max(999).optional(),
  hardCapPercent: z.number().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWithdrawalRulePayload = z.infer<typeof updateWithdrawalRuleSchema>;

// ---------------------------------------------------------------------------
// List filters (used by GET /requests query parsing)
// ---------------------------------------------------------------------------

export const withdrawalListFiltersSchema = z.object({
  workOrderId: z.coerce.number().int().positive().optional(),
  factoryCode: z.string().trim().max(40).nullable().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  reasonType: z.enum(WITHDRAWAL_REASON_TYPES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  requestedBy: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20).optional(),
});

// ---------------------------------------------------------------------------
// Approval action discriminated union
// ---------------------------------------------------------------------------

export const withdrawalApprovalActionSchema = z.enum(WITHDRAWAL_APPROVAL_ACTIONS);
