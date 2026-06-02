/**
 * Zod validation schemas for Primary Packaging (feature 019).
 */

import { z } from 'zod';
import {
  VARIANCE_REASONS,
  PROPOSED_RETURN_STATUSES,
  PACKAGING_CATEGORIES,
} from '@/types/packaging';

// ---------------------------------------------------------------------------
// Issuance
// ---------------------------------------------------------------------------

export const createIssuanceSchema = z.object({
  itemId: z.number().int().positive(),
  sourceLotId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  containerLabel: z.string().trim().min(3).max(50),
  roomId: z.number().int().positive(),
});

export const verifyIssuanceSchema = z.object({
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Return
// ---------------------------------------------------------------------------

export const createReturnSchema = z
  .object({
    woPackagingMaterialId: z.number().int().positive(),
    usedQty: z.number().int().min(0),
    returnQty: z.number().int().min(0),
    varianceReason: z.enum(VARIANCE_REASONS),
    varianceExplanation: z.string().trim().max(1000).optional(),
    returnContainerLabel: z.string().trim().min(3).max(50),
    proposedStatus: z.enum(PROPOSED_RETURN_STATUSES),
  })
  .superRefine((data, ctx) => {
    // Explanation required when proposed status is rejected
    if (data.proposedStatus === 'rejected') {
      if (!data.varianceExplanation || data.varianceExplanation.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['varianceExplanation'],
          message: 'Variance explanation is required when proposing rejected',
        });
      }
    }
  });

export const verifyReturnSchema = z.object({
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Approval (QA)
// ---------------------------------------------------------------------------

export const approveReturnSchema = z
  .object({
    finalStatus: z.enum(['approved_reusable', 'approved_quarantine', 'rejected']),
    overrideReason: z.string().trim().max(1000).optional(),
    qaNotes: z.string().trim().max(2000).optional(),
    password: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.finalStatus === 'rejected') {
      if (!data.qaNotes && !data.overrideReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['qaNotes'],
          message: 'QA notes or override reason required when rejecting',
        });
      }
    }
  });

export const rejectReturnSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  password: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Tolerance config (admin)
// ---------------------------------------------------------------------------

export const createToleranceSchema = z.object({
  packagingCategory: z.enum(PACKAGING_CATEGORIES),
  tolerancePercent: z.number().min(0).max(100),
  notes: z.string().trim().max(500).optional(),
});

export const updateToleranceSchema = z.object({
  tolerancePercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});
