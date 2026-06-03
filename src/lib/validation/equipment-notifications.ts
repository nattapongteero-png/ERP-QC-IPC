/**
 * Zod schemas for Feature 022
 */
import { z } from 'zod';

export const acknowledgeNotificationSchema = z.object({
  note: z.string().trim().max(1000).optional().nullable(),
});

export const snoozeNotificationSchema = z.object({
  snoozeDays: z.number().int().min(1).max(60),
  note: z.string().trim().max(500).optional().nullable(),
});

export const createMaintenancePlanTemplateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  maintenanceType: z.enum(['preventive', 'calibration', 'inspection', 'corrective']),
  intervalType: z.enum(['days', 'weeks', 'months', 'hours', 'units']),
  intervalValue: z.number().int().positive(),
  alertDaysBefore: z.number().int().min(0).max(365),
});

export const updateMaintenancePlanTemplateSchema = createMaintenancePlanTemplateSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export const applyTemplateSchema = z.object({
  templateId: z.number().int().positive(),
  equipmentIds: z.array(z.number().int().positive()).min(1),
});
