/**
 * Credit/Debit Notes Type Definitions (T077)
 * Part of 011-accounting-spec-gap - User Story 3
 */

/**
 * Note Type
 */
export type NoteType =
  | 'ar_credit'   // Credit note for AR (customer)
  | 'ap_credit'   // Credit note for AP (vendor)
  | 'ar_debit'    // Debit note for AR (customer)
  | 'ap_debit';   // Debit note for AP (vendor)

/**
 * Reference Type
 */
export type ReferenceType = 'ar_invoice' | 'ap_invoice';

/**
 * Note Status
 */
export type NoteStatus =
  | 'draft'       // Initial state, editable
  | 'submitted'   // Submitted for approval
  | 'approved'    // Approved, ready for posting
  | 'posted'      // Posted to GL
  | 'cancelled';  // Cancelled

/**
 * Reason Code
 */
export type ReasonCode =
  | 'return'              // Goods returned
  | 'price_adjustment'    // Price correction
  | 'quantity_adjustment' // Quantity correction
  | 'defect'              // Defective goods
  | 'discount'            // Additional discount
  | 'other';              // Other reason

/**
 * Credit/Debit Note Create Input
 */
export interface CreditDebitNoteCreateInput {
  noteType: NoteType;
  referenceInvoiceId: number;
  noteDate: string;
  reasonCode: ReasonCode;
  reasonDescription?: string;
  notes?: string;
  lines: CreditDebitNoteLineCreateInput[];
}

/**
 * Credit/Debit Note Update Input
 */
export interface CreditDebitNoteUpdateInput {
  noteDate?: string;
  reasonCode?: ReasonCode;
  reasonDescription?: string;
  notes?: string;
}

/**
 * Credit/Debit Note Line Create Input
 */
export interface CreditDebitNoteLineCreateInput {
  referenceInvoiceLineId?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  glAccountId: number;
}

/**
 * Credit/Debit Note Line Update Input
 */
export interface CreditDebitNoteLineUpdateInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  glAccountId?: number;
}

/**
 * Credit/Debit Note Header
 */
export interface CreditDebitNote {
  id: number;
  noteNumber: string;
  noteType: NoteType;
  referenceType: ReferenceType;
  referenceInvoiceId: number;
  referenceInvoiceNumber?: string;
  customerId?: number | null;
  customerName?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  noteDate: Date | string;
  reasonCode: ReasonCode;
  reasonDescription?: string | null;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  whtAmount: number;
  totalAmount: number;
  status: NoteStatus;
  journalEntryId?: number | null;
  journalEntryNumber?: string | null;
  vatTransactionId?: number | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedAt?: Date | string | null;
  postedAt?: Date | string | null;
  notes?: string | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Credit/Debit Note Line
 */
export interface CreditDebitNoteLine {
  id: number;
  noteId: number;
  lineNumber: number;
  referenceInvoiceLineId?: number | null;
  itemId?: number | null;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  glAccountId: number;
  glAccountCode?: string | null;
  glAccountName?: string | null;
  createdAt: Date | string;
}

/**
 * Credit/Debit Note with Lines
 */
export interface CreditDebitNoteWithLines extends CreditDebitNote {
  lines: CreditDebitNoteLine[];
}

/**
 * Invoice Available for Credit
 */
export interface InvoiceAvailableForCredit {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  originalAmount: number;
  paidAmount: number;
  creditedAmount: number;
  availableForCredit: number;
  customerId?: number | null;
  customerName?: string | null;
  vendorId?: number | null;
  vendorName?: string | null;
  lines: InvoiceLineAvailableForCredit[];
}

/**
 * Invoice Line Available for Credit
 */
export interface InvoiceLineAvailableForCredit {
  lineId: number;
  itemId?: number | null;
  itemCode?: string | null;
  description: string;
  originalQuantity: number;
  creditedQuantity: number;
  availableQuantity: number;
  unitPrice: number;
  glAccountId: number;
}

/**
 * Post Result
 */
export interface NotePostResult {
  success: boolean;
  journalEntryId?: number;
  journalEntryNumber?: string;
  vatTransactionId?: number;
  invoiceNewBalance?: number;
  error?: string;
}

/**
 * List Filter
 */
export interface CreditDebitNoteListFilter {
  noteType?: NoteType;
  status?: NoteStatus;
  customerId?: number;
  vendorId?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * List Response
 */
export interface CreditDebitNoteListResponse {
  data: CreditDebitNote[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Dashboard Summary
 */
export interface CreditDebitNoteDashboardSummary {
  draftCount: number;
  pendingApprovalCount: number;
  postedThisMonth: number;
  totalCreditedThisMonth: number;
  totalDebitedThisMonth: number;
  recentNotes: CreditDebitNote[];
}

/**
 * Submit for Approval Response
 */
export interface NoteSubmitResponse {
  success: boolean;
  noteId: number;
  noteNumber: string;
  approvalRequestId?: number;
  flowName?: string;
  error?: string;
}

/**
 * Cancel Input
 */
export interface NoteCancelInput {
  reason: string;
}

/**
 * Invoice Reference (for selection dropdown)
 */
export interface InvoiceReference {
  id: number;
  invoiceNumber: string;
  invoiceDate: Date | string;
  totalAmount: number;
  currency: string;
  customerOrVendorName: string;
  type: 'ar' | 'ap';
}

/**
 * Invoice Line Reference (for line selection)
 */
export interface InvoiceLineReference {
  id: number;
  lineNumber: number;
  itemId?: number | null;
  itemCode?: string | null;
  itemName?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * Note Summary (for dashboard widget)
 */
export interface NoteSummary {
  draftCount: number;
  pendingApprovalCount: number;
  postedThisMonth: number;
  totalThisMonth: number;
  byType: {
    arCredit: number;
    apCredit: number;
    arDebit: number;
    apDebit: number;
  };
}

/**
 * Reason Code Option
 */
export const REASON_CODE_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'return', label: 'Goods Return' },
  { value: 'price_adjustment', label: 'Price Adjustment' },
  { value: 'quantity_adjustment', label: 'Quantity Adjustment' },
  { value: 'defect', label: 'Defective Goods' },
  { value: 'discount', label: 'Early Payment Discount' },
  { value: 'other', label: 'Other' },
];

/**
 * Note Type Option
 */
export const NOTE_TYPE_OPTIONS: { value: NoteType; label: string; description: string }[] = [
  { value: 'ar_credit', label: 'AR Credit Note', description: 'Credit to customer (reduces AR)' },
  { value: 'ap_credit', label: 'AP Credit Note', description: 'Credit from vendor (reduces AP)' },
  { value: 'ar_debit', label: 'AR Debit Note', description: 'Debit to customer (increases AR)' },
  { value: 'ap_debit', label: 'AP Debit Note', description: 'Debit to vendor (increases AP)' },
];
