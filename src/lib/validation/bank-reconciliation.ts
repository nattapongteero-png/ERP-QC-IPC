/**
 * Bank Reconciliation Validation Schemas (T053)
 * Part of 011-accounting-spec-gap - User Story 2
 */

import { z } from 'zod';

/**
 * Bank Statement Status
 */
export const bankStatementStatusSchema = z.enum([
  'draft',
  'in_progress',
  'reconciled',
  'closed',
]);

/**
 * Statement Line Status
 */
export const statementLineStatusSchema = z.enum([
  'unmatched',
  'matched',
  'partially_matched',
  'journal_created',
  'ignored',
]);

/**
 * Transaction Type
 */
export const transactionTypeSchema = z.enum(['credit', 'debit']);

/**
 * Match Type
 */
export const matchTypeSchema = z.enum(['auto', 'manual', 'suggested']);

/**
 * Bank Statement Create Schema
 */
export const bankStatementCreateSchema = z.object({
  bankAccountId: z.number().int().positive('Bank account is required'),
  statementDate: z.string().min(1, 'Statement date is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  openingBalance: z.number(),
  closingBalance: z.number(),
  currency: z.string().optional().default('THB'),
  reference: z.string().optional(),
});

/**
 * Bank Statement Update Schema
 */
export const bankStatementUpdateSchema = z.object({
  statementDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  openingBalance: z.number().optional(),
  closingBalance: z.number().optional(),
  reference: z.string().optional(),
});

/**
 * Bank Statement Line Import Schema (single line from CSV)
 */
export const bankStatementLineImportSchema = z.object({
  transactionDate: z.string().min(1, 'Transaction date is required'),
  valueDate: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  debitAmount: z.number().optional(),
  creditAmount: z.number().optional(),
  balance: z.number().optional(),
  transactionCode: z.string().optional(),
});

/**
 * Bulk Import Schema
 */
export const bulkImportSchema = z.object({
  bankAccountId: z.number().int().positive('Bank account is required'),
  statementDate: z.string().min(1, 'Statement date is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  openingBalance: z.number(),
  closingBalance: z.number(),
  currency: z.string().optional().default('THB'),
  reference: z.string().optional(),
  lines: z.array(bankStatementLineImportSchema).min(1, 'At least one line is required'),
});

/**
 * CSV Import Config Schema
 */
export const csvImportConfigSchema = z.object({
  dateFormat: z.string().min(1, 'Date format is required'),
  dateColumn: z.string().min(1, 'Date column is required'),
  descriptionColumn: z.string().min(1, 'Description column is required'),
  debitColumn: z.string().optional(),
  creditColumn: z.string().optional(),
  amountColumn: z.string().optional(),
  referenceColumn: z.string().optional(),
  balanceColumn: z.string().optional(),
  hasHeader: z.boolean().default(true),
  delimiter: z.string().optional().default(','),
});

/**
 * Manual Match Input Schema
 */
export const manualMatchInputSchema = z.object({
  statementLineId: z.number().int().positive('Statement line is required'),
  matchedEntityType: z.enum(['ap_payment', 'ar_receipt', 'journal_entry']),
  matchedEntityId: z.number().int().positive('Matched entity is required'),
  notes: z.string().optional(),
});

/**
 * Bulk Match Input Schema
 */
export const bulkMatchInputSchema = z.object({
  matches: z.array(manualMatchInputSchema).min(1, 'At least one match is required'),
});

/**
 * Bank Charge Journal Input Schema
 */
export const bankChargeJournalInputSchema = z.object({
  statementLineId: z.number().int().positive('Statement line is required'),
  chargeType: z.enum(['bank_fee', 'interest_expense', 'interest_income', 'other']),
  accountId: z.number().int().positive('Account is required'),
  description: z.string().optional(),
});

/**
 * Unmatch Input Schema
 */
export const unmatchInputSchema = z.object({
  statementLineId: z.number().int().positive('Statement line is required'),
});

/**
 * Ignore Line Input Schema
 */
export const ignoreLineInputSchema = z.object({
  statementLineId: z.number().int().positive('Statement line is required'),
  notes: z.string().optional(),
});

/**
 * Bank Statement List Filter Schema
 */
export const bankStatementListFilterSchema = z.object({
  bankAccountId: z.coerce.number().int().positive().optional(),
  status: bankStatementStatusSchema.optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

/**
 * Finalize Reconciliation Schema
 */
export const finalizeReconciliationSchema = z.object({
  statementId: z.number().int().positive('Statement ID is required'),
  forceClose: z.boolean().optional().default(false),
});

/**
 * Auto Match Config Schema
 */
export const autoMatchConfigSchema = z.object({
  statementId: z.number().int().positive('Statement ID is required'),
  matchByAmount: z.boolean().optional().default(true),
  matchByReference: z.boolean().optional().default(true),
  matchByDate: z.boolean().optional().default(true),
  dateToleranceDays: z.number().int().min(0).max(30).optional().default(3),
  amountTolerancePercent: z.number().min(0).max(5).optional().default(0),
});

// Type exports
export type BankStatementCreateInput = z.infer<typeof bankStatementCreateSchema>;
export type BankStatementUpdateInput = z.infer<typeof bankStatementUpdateSchema>;
export type BankStatementLineImportInput = z.infer<typeof bankStatementLineImportSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type CSVImportConfigInput = z.infer<typeof csvImportConfigSchema>;
export type ManualMatchInput = z.infer<typeof manualMatchInputSchema>;
export type BulkMatchInput = z.infer<typeof bulkMatchInputSchema>;
export type BankChargeJournalInput = z.infer<typeof bankChargeJournalInputSchema>;
export type UnmatchInput = z.infer<typeof unmatchInputSchema>;
export type IgnoreLineInput = z.infer<typeof ignoreLineInputSchema>;
export type BankStatementListFilterInput = z.infer<typeof bankStatementListFilterSchema>;
export type FinalizeReconciliationInput = z.infer<typeof finalizeReconciliationSchema>;
export type AutoMatchConfigInput = z.infer<typeof autoMatchConfigSchema>;
