/**
 * Zod schemas for Feature 023
 */
import { z } from 'zod';
import {
  INSPECTION_TARGET_TYPES,
  INSPECTION_FREQUENCIES,
  WATER_SYSTEM_TYPES,
} from '@/types/environmental-monitoring';

export const signatureSchema = z
  .object({
    password: z.string().optional(),
    pin: z.string().optional(),
  })
  .refine((s) => Boolean(s.password || s.pin), {
    message: 'Either password or pin is required',
  });

export const inspectionTemplateItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  parameter: z.string().trim().min(1).max(50),
  unit: z.string().trim().max(20).optional().nullable(),
  specMin: z.number().optional().nullable(),
  specMax: z.number().optional().nullable(),
  specText: z.string().trim().max(200).optional().nullable(),
  isMandatory: z.boolean(),
  sortOrder: z.number().int().min(1),
});

export const createInspectionTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  targetType: z.enum(
    INSPECTION_TARGET_TYPES as ['room', 'storage_area', 'quarantine', 'water_point'],
  ),
  items: z.array(inspectionTemplateItemSchema).min(1).max(50),
});

export const createInspectionScheduleSchema = z.object({
  targetType: z.enum(
    INSPECTION_TARGET_TYPES as ['room', 'storage_area', 'quarantine', 'water_point'],
  ),
  targetId: z.number().int().positive(),
  targetName: z.string().trim().min(1).max(100),
  templateId: z.number().int().positive(),
  frequency: z.enum(
    INSPECTION_FREQUENCIES as ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
  ),
  alertDaysBefore: z.number().int().min(0).max(365).default(1),
});

export const recordInspectionResultItemSchema = z.object({
  templateItemId: z.number().int().positive(),
  parameter: z.string().trim().min(1).max(50),
  numericValue: z.number().optional().nullable(),
  textValue: z.string().trim().max(500).optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export const recordInspectionSchema = z.object({
  scheduleId: z.number().int().positive().optional().nullable(),
  templateId: z.number().int().positive(),
  targetType: z.enum(
    INSPECTION_TARGET_TYPES as ['room', 'storage_area', 'quarantine', 'water_point'],
  ),
  targetId: z.number().int().positive(),
  results: z.array(recordInspectionResultItemSchema).min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
  signature: signatureSchema,
});

// ============================================
// Water
// ============================================

export const createWaterSystemSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  systemType: z.enum(
    WATER_SYSTEM_TYPES as ['tap', 'ro', 'purified', 'wfi', 'usp_purified', 'other'],
  ),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const createSamplePointSchema = z.object({
  waterSystemId: z.number().int().positive(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  location: z.string().trim().max(200).optional().nullable(),
});

export const createWaterSpecSchema = z.object({
  waterSystemId: z.number().int().positive(),
  samplePointId: z.number().int().positive().optional().nullable(),
  parameter: z.string().trim().min(1).max(30),
  // Allow empty unit (dimensionless, e.g. pH)
  unit: z.string().trim().max(20).default(''),
  specMin: z.number().optional().nullable(),
  specMax: z.number().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const recordWaterTestResultItemSchema = z.object({
  specId: z.number().int().positive().optional().nullable(),
  parameter: z.string().trim().min(1).max(30),
  numericValue: z.number().optional().nullable(),
  unit: z.string().trim().max(20).default(''),
});

export const recordWaterTestSchema = z.object({
  samplePointId: z.number().int().positive(),
  waterSystemId: z.number().int().positive(),
  results: z.array(recordWaterTestResultItemSchema).min(1),
  notes: z.string().trim().max(1000).optional().nullable(),
  signature: signatureSchema,
});
