import { z } from 'zod';

export const QC_TEST_CATEGORIES = ['chemical', 'physical', 'microbial', 'sensory', 'stability', 'other'] as const;
export type QcTestCategory = (typeof QC_TEST_CATEGORIES)[number];

export const qcTestCatalogCreateSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(50),
  name: z.string().trim().min(1, 'Name is required').max(255),
  nameTh: z.string().trim().max(255).optional().nullable(),
  category: z.enum(QC_TEST_CATEGORIES).default('other'),
  testMethod: z.string().trim().max(255).optional().nullable(),
  defaultUnit: z.string().trim().max(50).optional().nullable(),
  defaultMin: z.number().nullable().optional(),
  defaultMax: z.number().nullable().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const qcTestCatalogUpdateSchema = qcTestCatalogCreateSchema.partial();

export type QcTestCatalogCreate = z.infer<typeof qcTestCatalogCreateSchema>;
export type QcTestCatalogUpdate = z.infer<typeof qcTestCatalogUpdateSchema>;
