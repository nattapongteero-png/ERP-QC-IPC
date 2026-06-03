/**
 * Zod schemas for Feature 020 Goods Receipt
 */
import { z } from 'zod';
import { CHECKLIST_CATEGORIES, GRN_SOURCE_TYPES } from '@/types/goods-receipt';

export const createGrnSchema = z
  .object({
    sourceType: z.enum(GRN_SOURCE_TYPES as ['po', 'wo']),
    poId: z.number().int().positive().optional().nullable(),
    woId: z.number().int().positive().optional().nullable(),
    warehouseId: z.number().int().positive(),
    receivedDate: z.string().min(1),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.sourceType === 'po') {
      if (!data.poId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['poId'],
          message: 'poId required when sourceType=po',
        });
      }
      if (data.woId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['woId'],
          message: 'woId must be null when sourceType=po',
        });
      }
    } else {
      if (!data.woId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['woId'],
          message: 'woId required when sourceType=wo',
        });
      }
      if (data.poId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['poId'],
          message: 'poId must be null when sourceType=wo',
        });
      }
    }
  });

export const updateGrnHeaderSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  receivedDate: z.string().optional(),
});

export const updateGrnLineSchema = z
  .object({
    actualQuantity: z.number().min(0).optional(),
    vendorLotNumber: z.string().trim().max(50).optional().nullable(),
    batchNumber: z.string().trim().max(50).optional().nullable(),
    manufacturingDate: z.string().optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    varianceReason: z.string().trim().max(1000).optional().nullable(),
  })
  .refine(
    (data) =>
      !data.manufacturingDate ||
      !data.expiryDate ||
      data.expiryDate > data.manufacturingDate,
    {
      message: 'Expiry date must be after manufacturing date',
      path: ['expiryDate'],
    },
  );

export const signatureSchema = z.object({
  password: z.string().optional(),
  pin: z.string().optional(),
}).refine((s) => Boolean(s.password || s.pin), {
  message: 'Either password or pin is required',
});

export const signChecklistSchema = z.object({
  items: z
    .array(
      z.object({
        templateItemId: z.number().int().positive(),
        isPass: z.boolean(),
        remarks: z.string().trim().max(500).optional().nullable(),
      }),
    )
    .min(1),
  signature: signatureSchema,
});

export const qaActionSchema = z
  .object({
    action: z.enum(['release', 'reject']),
    rejectionReason: z.string().trim().min(10).max(1000).optional(),
    signature: signatureSchema,
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reject' && !data.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'Rejection reason required when action=reject',
      });
    }
  });

export const cancelGrnSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
});

export const checklistTemplateItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  isMandatory: z.boolean(),
  sortOrder: z.number().int().min(1),
});

export const createChecklistTemplateSchema = z.object({
  category: z.enum(CHECKLIST_CATEGORIES as ['raw_material', 'finished_goods']),
  items: z.array(checklistTemplateItemSchema).min(1).max(50),
});

export const updateChecklistTemplateSchema = z.object({
  isCurrent: z.boolean().optional(),
});

export const updateToleranceSchema = z.object({
  tolerancePercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
