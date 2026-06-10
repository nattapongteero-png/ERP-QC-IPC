/**
 * Credit/Debit Note Validation Schemas (T078)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { z } from 'zod';

/**
 * Note Type
 */
export const noteTypeSchema = z.enum([
  'ar_credit',
  'ap_credit',
  'ar_debit',
  'ap_debit',
]);

/**
 * Reference Type
 */
export const referenceTypeSchema = z.enum(['ar_invoice', 'ap_invoice']);

/**
 * Reason Code
 */
export const reasonCodeSchema = z.enum([
  'return',
  'price_adjustment',
  'quantity_adjustment',
  'defect',
  'discount',
  'other',
]);

/**
 * Note Status
 */
export const noteStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'posted',
  'cancelled',
]);

/**
 * Note Line Input Schema
 */
export const noteLineInputSchema = z.object({
  referenceInvoiceLineId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  glAccountId: z.number().int().positive('GL Account is required'),
});

/**
 * Note Create Schema
 */
export const noteCreateSchema = z.object({
  noteType: noteTypeSchema,
  referenceType: referenceTypeSchema,
  referenceInvoiceId: z.number().int().positive('Reference invoice is required'),
  customerId: z.number().int().positive().optional(),
  vendorId: z.number().int().positive().optional(),
  noteDate: z.string().min(1, 'Note date is required'),
  reasonCode: reasonCodeSchema,
  reasonDescription: z.string().optional(),
  vatRate: z.number().min(0).max(1).optional().default(0.07),
  notes: z.string().optional(),
  lines: z.array(noteLineInputSchema).min(1, 'At least one line is required'),
}).refine(
  (data) => {
    // AR notes require customerId, AP notes require vendorId
    if (data.noteType.startsWith('ar_') && !data.customerId) {
      return false;
    }
    if (data.noteType.startsWith('ap_') && !data.vendorId) {
      return false;
    }
    return true;
  },
  {
    message: 'Customer ID is required for AR notes, Vendor ID is required for AP notes',
  }
);

/**
 * Note Update Schema
 */
export const noteUpdateSchema = z.object({
  noteDate: z.string().optional(),
  reasonCode: reasonCodeSchema.optional(),
  reasonDescription: z.string().optional(),
  vatRate: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  lines: z.array(noteLineInputSchema).optional(),
});

/**
 * Note List Filter Schema
 */
// Built from searchParams.get() (yields null for absent params) — use nullish
// + null-preprocessing so absent filters don't fail validation and 500 the page.
const _nz = (s: z.ZodTypeAny) => z.preprocess((v) => (v === null || v === '' ? undefined : v), s);
export const noteListFilterSchema = z.object({
  noteType: _nz(noteTypeSchema.optional()),
  referenceType: _nz(referenceTypeSchema.optional()),
  status: _nz(noteStatusSchema.optional()),
  customerId: z.coerce.number().int().positive().nullish(),
  vendorId: z.coerce.number().int().positive().nullish(),
  fromDate: _nz(z.string().optional()),
  toDate: _nz(z.string().optional()),
  search: _nz(z.string().optional()),
  page: z.coerce.number().int().positive().nullish().transform((v) => v ?? 1),
  limit: z.coerce.number().int().positive().max(100).nullish().transform((v) => v ?? 20),
});

/**
 * Note Approval Schema
 */
export const noteApprovalSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  approved: z.boolean(),
  comments: z.string().optional(),
});

/**
 * Note Post Schema
 */
export const notePostSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  postingDate: z.string().optional(),
});

/**
 * Note Cancel Schema
 */
export const noteCancelSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  reason: z.string().min(1, 'Cancellation reason is required'),
});

// Type exports
export type NoteType = z.infer<typeof noteTypeSchema>;
export type ReferenceType = z.infer<typeof referenceTypeSchema>;
export type ReasonCode = z.infer<typeof reasonCodeSchema>;
export type NoteStatus = z.infer<typeof noteStatusSchema>;
export type NoteLineInput = z.infer<typeof noteLineInputSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>;
export type NoteListFilterInput = z.infer<typeof noteListFilterSchema>;
export type NoteApprovalInput = z.infer<typeof noteApprovalSchema>;
export type NotePostInput = z.infer<typeof notePostSchema>;
export type NoteCancelInput = z.infer<typeof noteCancelSchema>;
