// Template Module Validation Schemas
import { z } from 'zod';

// Enums
export const templateItemStatusSchema = z.enum(['draft', 'active', 'archived']);
export const templateItemPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

// Date regex pattern for YYYY-MM-DD format
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
// Time regex pattern for HH:mm:ss format
const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

// Template Item Create Schema
export const templateItemCreateSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50, 'Code must be 50 characters or less'),
  nameTh: z.string().min(1, 'Thai name is required').max(200, 'Thai name must be 200 characters or less'),
  nameEn: z.string().max(200, 'English name must be 200 characters or less').optional().nullable(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional().nullable(),
  status: templateItemStatusSchema.optional().default('draft'),
  priority: templateItemPrioritySchema.optional().default('medium'),
  categoryId: z.number().int().positive().optional().nullable(),
  quantity: z.number().nonnegative('Quantity must be 0 or greater').optional().default(0),
  unitPrice: z.number().nonnegative('Unit price must be 0 or greater').optional().default(0),
  dueDate: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  dueTime: z.string().regex(timePattern, 'Time must be in HH:mm or HH:mm:ss format').optional().nullable(),
  notes: z.string().max(2000, 'Notes must be 2000 characters or less').optional().nullable(),
});

// Template Item Update Schema
export const templateItemUpdateSchema = z.object({
  nameTh: z.string().min(1).max(200).optional(),
  nameEn: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  status: templateItemStatusSchema.optional(),
  priority: templateItemPrioritySchema.optional(),
  categoryId: z.number().int().positive().optional().nullable(),
  quantity: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  dueDate: z.string().regex(datePattern, 'Date must be in YYYY-MM-DD format').optional().nullable(),
  dueTime: z.string().regex(timePattern, 'Time must be in HH:mm or HH:mm:ss format').optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// Template Category Create Schema
export const templateCategoryCreateSchema = z.object({
  code: z.string().min(1, 'Code is required').max(20, 'Code must be 20 characters or less'),
  nameTh: z.string().min(1, 'Thai name is required').max(100, 'Thai name must be 100 characters or less'),
  nameEn: z.string().max(100, 'English name must be 100 characters or less').optional().nullable(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional().default('#3B82F6'),
  sortOrder: z.number().int().nonnegative().optional().default(0),
});

// Template Category Update Schema
export const templateCategoryUpdateSchema = z.object({
  nameTh: z.string().min(1).max(100).optional(),
  nameEn: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

// Type exports
export type TemplateItemCreateInput = z.infer<typeof templateItemCreateSchema>;
export type TemplateItemUpdateInput = z.infer<typeof templateItemUpdateSchema>;
export type TemplateCategoryCreateInput = z.infer<typeof templateCategoryCreateSchema>;
export type TemplateCategoryUpdateInput = z.infer<typeof templateCategoryUpdateSchema>;
