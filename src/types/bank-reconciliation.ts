/**
 * Bank Reconciliation Type Definitions (T052)
 * Part of 011-accounting-spec-gap - User Story 2
 */

/**
 * Bank Statement Status
 */
export type BankStatementStatus =
  | 'draft'           // Just imported, not processed
  | 'in_progress'     // Matching in progress
  | 'reconciled'      // Fully reconciled
  | 'closed';         // Closed and locked

/**
 * Statement Line Status
 */
export type StatementLineStatus =
  | 'unmatched'       // Not yet matched
  | 'matched'         // Matched to payment/receipt
  | 'partially_matched' // Partially matched
  | 'journal_created' // Bank charge/interest journal created
  | 'ignored';        // Marked as ignored

/**
 * Transaction Type
 */
export type TransactionType = 'credit' | 'debit';

/**
 * Match Type
 */
export type MatchType =
  | 'auto'            // Auto-matched by system
  | 'manual'          // Manually matched by user
  | 'suggested';      // System suggestion, pending confirmation

/**
 * Bank Statement Header Input
 */
export interface BankStatementCreateInput {
  bankAccountId: number;
  statementDate: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  currency?: string;
  reference?: string;
}

/**
 * Bank Statement Line from CSV Import
 */
export interface BankStatementLineImport {
  transactionDate: string;
  valueDate?: string;
  description: string;
  reference?: string;
  debitAmount?: number;
  creditAmount?: number;
  balance?: number;
  transactionCode?: string;
}

/**
 * Bank Statement Header
 */
export interface BankStatement {
  id: number;
  bankAccountId: number;
  bankAccountName?: string;
  bankAccountNumber?: string;
  statementNumber: string;
  statementDate: Date | string;
  startDate: Date | string;
  endDate: Date | string;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  reference?: string | null;
  status: BankStatementStatus;
  totalDebits: number;
  totalCredits: number;
  matchedCount: number;
  unmatchedCount: number;
  reconciledAt?: Date | string | null;
  reconciledBy?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Bank Statement Line
 */
export interface BankStatementLine {
  id: number;
  statementId: number;
  lineNumber: number;
  transactionDate: Date | string;
  valueDate?: Date | string | null;
  description: string;
  reference?: string | null;
  transactionType: TransactionType;
  amount: number;
  runningBalance?: number | null;
  transactionCode?: string | null;
  status: StatementLineStatus;
  matchedPaymentId?: number | null;
  matchedReceiptId?: number | null;
  matchType?: MatchType | null;
  matchConfidence?: number | null;
  journalEntryId?: number | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Bank Statement with Lines
 */
export interface BankStatementWithLines extends BankStatement {
  lines: BankStatementLine[];
}

/**
 * Reconciliation Match Record
 */
export interface ReconciliationMatch {
  id: number;
  statementLineId: number;
  matchedEntityType: 'ap_payment' | 'ar_receipt' | 'journal_entry';
  matchedEntityId: number;
  matchType: MatchType;
  matchConfidence: number;
  amountMatched: number;
  matchedAt: Date | string;
  matchedBy?: number | null;
  notes?: string | null;
}

/**
 * Unmatched Payment/Receipt for matching UI
 */
export interface UnmatchedPayment {
  id: number;
  type: 'payment' | 'receipt';
  documentNumber: string;
  date: Date | string;
  amount: number;
  vendorOrCustomerName: string;
  reference?: string;
  description?: string;
}

/**
 * Auto-match Result
 */
export interface AutoMatchResult {
  totalProcessed: number;
  matchedCount: number;
  unmatchedCount: number;
  matches: {
    lineId: number;
    matchedToId: number;
    matchedToType: 'ap_payment' | 'ar_receipt';
    confidence: number;
  }[];
}

/**
 * Manual Match Input
 */
export interface ManualMatchInput {
  statementLineId: number;
  matchedEntityType: 'ap_payment' | 'ar_receipt' | 'journal_entry';
  matchedEntityId: number;
  notes?: string;
}

/**
 * Bank Charge Journal Input
 */
export interface BankChargeJournalInput {
  statementLineId: number;
  chargeType: 'bank_fee' | 'interest_expense' | 'interest_income' | 'other';
  accountId: number;
  description?: string;
}

/**
 * CSV Import Configuration
 */
export interface CSVImportConfig {
  dateFormat: string;
  dateColumn: string;
  descriptionColumn: string;
  debitColumn?: string;
  creditColumn?: string;
  amountColumn?: string;
  referenceColumn?: string;
  balanceColumn?: string;
  hasHeader: boolean;
  delimiter?: string;
}

/**
 * Import Result
 */
export interface ImportResult {
  success: boolean;
  statementId: number;
  statementNumber: string;
  linesImported: number;
  errors?: string[];
}

/**
 * List Filter
 */
export interface BankStatementListFilter {
  bankAccountId?: number;
  status?: BankStatementStatus;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Reconciliation Summary
 */
export interface ReconciliationSummary {
  openingBalance: number;
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  matchedDebits: number;
  matchedCredits: number;
  unmatchedDebits: number;
  unmatchedCredits: number;
  difference: number;
  isBalanced: boolean;
}
