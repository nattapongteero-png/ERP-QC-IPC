/**
 * Zod schemas for Feature 021 — Scale Verification
 */
import { z } from 'zod';
import { ACCURACY_CLASSES } from '@/types/scale-verification';

export const signatureSchema = z.object({
  password: z.string().optional(),
  pin: z.string().optional(),
}).refine((s) => Boolean(s.password || s.pin), {
  message: 'Either password or pin is required',
});

export const createStandardWeightSchema = z.object({
  code: z.string().trim().min(1).max(50),
  denominationValue: z.number().positive(),
  denominationUnit: z.enum(['g', 'kg', 'mg']),
  accuracyClass: z.enum(ACCURACY_CLASSES as ['E1', 'E2', 'F1', 'F2', 'M1']),
  certificateNumber: z.string().trim().min(1).max(100),
  certificateIssuer: z.string().trim().min(1).max(200),
  certificateIssueDate: z.string().min(1),
  certificateExpiryDate: z.string().min(1),
  ownerDepartment: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
}).refine((d) => d.certificateExpiryDate > d.certificateIssueDate, {
  message: 'Expiry date must be after issue date',
  path: ['certificateExpiryDate'],
});

export const updateStandardWeightSchema = z.object({
  certificateNumber: z.string().trim().min(1).max(100).optional(),
  certificateIssuer: z.string().trim().min(1).max(200).optional(),
  certificateIssueDate: z.string().optional(),
  certificateExpiryDate: z.string().optional(),
  ownerDepartment: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export const createVerificationSchema = z.object({
  scaleId: z.number().int().positive(),
  standardWeightId: z.number().int().positive(),
  actualReading: z.number().nonnegative(),
  notes: z.string().trim().max(1000).optional().nullable(),
  signature: signatureSchema,
});

export const updateScaleConfigSchema = z.object({
  verificationIntervalHours: z.number().int().min(1).max(168).optional(),
  minVerificationWeightG: z.number().positive().optional().nullable(),
  maxVerificationWeightG: z.number().positive().optional().nullable(),
  tolerancePercent: z.number().min(0).max(100).optional(),
  scaleStatus: z.enum(['active', 'out_of_service', 'maintenance']).optional(),
});
