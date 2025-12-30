/**
 * Credit/Debit Notes Validation Schemas (T078)
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { z } from 'zod';

/**
 * Note Type Schema
 */
export const noteTypeSchema = z.enum([
  'ar_credit',
  'ap_credit',
  'ar_debit',
  'ap_debit',
]);

/**
 * Reference Type Schema
 */
export const referenceTypeSchema = z.enum(['ar_invoice', 'ap_invoice']);

/**
 * Note Status Schema
 */
export const noteStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'posted',
  'cancelled',
]);

/**
 * Reason Code Schema
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
 * Note Line Create Schema
 */
export const noteLineCreateSchema = z.object({
  referenceInvoiceLineId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  glAccountId: z.number().int().positive('GL Account is required'),
});

/**
 * Note Line Update Schema
 */
export const noteLineUpdateSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().min(0).optional(),
  glAccountId: z.number().int().positive().optional(),
});

/**
 * Credit/Debit Note Create Schema
 */
export const creditDebitNoteCreateSchema = z.object({
  noteType: noteTypeSchema,
  referenceInvoiceId: z.number().int().positive('Reference invoice is required'),
  noteDate: z.string().min(1, 'Note date is required'),
  reasonCode: reasonCodeSchema,
  reasonDescription: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(noteLineCreateSchema).min(1, 'At least one line is required'),
}).refine(
  (data) => {
    // Validate noteType matches referenceType
    if (data.noteType.startsWith('ar_')) {
      return true; // Will be validated against ar_invoice
    }
    if (data.noteType.startsWith('ap_')) {
      return true; // Will be validated against ap_invoice
    }
    return false;
  },
  {
    message: 'Note type must match reference invoice type',
    path: ['noteType'],
  }
);

/**
 * Credit/Debit Note Update Schema
 */
export const creditDebitNoteUpdateSchema = z.object({
  noteDate: z.string().optional(),
  reasonCode: reasonCodeSchema.optional(),
  reasonDescription: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Note Cancel Schema
 */
export const noteCancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

/**
 * List Filter Schema
 */
export const creditDebitNoteListFilterSchema = z.object({
  noteType: noteTypeSchema.optional(),
  status: noteStatusSchema.optional(),
  customerId: z.coerce.number().int().positive().optional(),
  vendorId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Invoice Available for Credit Query Schema
 */
export const invoiceAvailableForCreditQuerySchema = z.object({
  invoiceType: z.enum(['ar', 'ap']),
});

/**
 * Add Line Schema
 */
export const addNoteLineSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  line: noteLineCreateSchema,
});

/**
 * Update Line Schema
 */
export const updateNoteLineSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  lineId: z.number().int().positive('Line ID is required'),
  data: noteLineUpdateSchema,
});

/**
 * Delete Line Schema
 */
export const deleteNoteLineSchema = z.object({
  noteId: z.number().int().positive('Note ID is required'),
  lineId: z.number().int().positive('Line ID is required'),
});

// Type exports
export type NoteType = z.infer<typeof noteTypeSchema>;
export type ReferenceType = z.infer<typeof referenceTypeSchema>;
export type NoteStatus = z.infer<typeof noteStatusSchema>;
export type ReasonCode = z.infer<typeof reasonCodeSchema>;
export type NoteLineCreateInput = z.infer<typeof noteLineCreateSchema>;
export type NoteLineUpdateInput = z.infer<typeof noteLineUpdateSchema>;
export type CreditDebitNoteCreateInput = z.infer<typeof creditDebitNoteCreateSchema>;
export type CreditDebitNoteUpdateInput = z.infer<typeof creditDebitNoteUpdateSchema>;
export type NoteCancelInput = z.infer<typeof noteCancelSchema>;
export type CreditDebitNoteListFilterInput = z.infer<typeof creditDebitNoteListFilterSchema>;
export type InvoiceAvailableForCreditQuery = z.infer<typeof invoiceAvailableForCreditQuerySchema>;
