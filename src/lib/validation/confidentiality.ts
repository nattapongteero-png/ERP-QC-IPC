/**
 * BOM Confidentiality Validation Schemas
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 */

import { z } from 'zod';

// Confidentiality levels
export const confidentialityLevelSchema = z.enum(['public', 'internal', 'confidential']);
export const confidentialityOverrideSchema = z.enum(['inherit', 'public', 'confidential']);

// Confidential Access Group
export const confidentialAccessGroupCreateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric with underscores'),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const confidentialAccessGroupUpdateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_]+$/).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// Group Member
export const addGroupMemberSchema = z.object({
  userId: z.number().int().positive(),
});

// BOM Access Grant
export const bomAccessGrantSchema = z.object({
  userId: z.number().int().positive().optional(),
  groupId: z.number().int().positive().optional(),
}).refine(
  (data) => (data.userId !== undefined) !== (data.groupId !== undefined),
  { message: 'Exactly one of userId or groupId must be provided' }
);

// Bypass Roles Setting
export const bypassRolesSettingSchema = z.object({
  roles: z.array(z.string().min(1)),
});

// Item confidentiality update
export const itemConfidentialityUpdateSchema = z.object({
  confidentialityLevel: confidentialityLevelSchema.optional(),
  defaultConfidential: z.boolean().optional(),
});

// BOM line confidentiality update
export const bomLineConfidentialityUpdateSchema = z.object({
  confidentialityOverride: confidentialityOverrideSchema,
});
