/**
 * Credit/Debit Note Type Definitions (T077)
 * Part of 011-accounting-spec-gap - User Story 3
 */

/**
 * Note Type
 */
export type NoteType =
  | 'ar_credit'    // Customer credit note (AR)
  | 'ap_credit'    // Vendor credit note (AP)
  | 'ar_debit'     // Customer debit note (AR)
  | 'ap_debit';    // Vendor debit note (AP)

/**
 * Reference Type
 */
export type ReferenceType = 'ar_invoice' | 'ap_invoice';

/**
 * Reason Code
 */
export type ReasonCode =
  | 'return'                // Goods return
  | 'price_adjustment'      // Price adjustment
  | 'quantity_adjustment'   // Quantity adjustment
  | 'defect'                // Defective goods
  | 'discount'              // Early payment discount
  | 'other';                // Other reason

/**
 * Note Status
 */
export type NoteStatus =
  | 'draft'         // Just created
  | 'submitted'     // Submitted for approval
  | 'approved'      // Approved, pending posting
  | 'posted'        // Posted to GL and VAT
  | 'cancelled';    // Cancelled

/**
 * Credit/Debit Note
 */
export interface CreditDebitNote {
  id: number;
  noteNumber: string;
  noteType: NoteType;
  referenceType: ReferenceType;
  referenceInvoiceId: number;
  referenceInvoiceNumber?: string;
  customerId?: number | null;
  customerName?: string;
  vendorId?: number | null;
  vendorName?: string;
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
  vatTransactionId?: number | null;
  approvedBy?: number | null;
  approvedByName?: string;
  approvedAt?: Date | string | null;
  postedAt?: Date | string | null;
  notes?: string | null;
  createdBy: number;
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
  itemCode?: string;
  itemName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  glAccountId: number;
  glAccountNumber?: string;
  glAccountName?: string;
  createdAt: Date | string;
}

/**
 * Credit/Debit Note with Lines
 */
export interface CreditDebitNoteWithLines extends CreditDebitNote {
  lines: CreditDebitNoteLine[];
}

/**
 * Note Create Input
 */
export interface NoteCreateInput {
  noteType: NoteType;
  referenceType: ReferenceType;
  referenceInvoiceId: number;
  customerId?: number;
  vendorId?: number;
  noteDate: string;
  reasonCode: ReasonCode;
  reasonDescription?: string;
  vatRate?: number;
  notes?: string;
  lines: NoteLineInput[];
}

/**
 * Note Line Input
 */
export interface NoteLineInput {
  referenceInvoiceLineId?: number;
  itemId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  glAccountId: number;
}

/**
 * Note Update Input
 */
export interface NoteUpdateInput {
  noteDate?: string;
  reasonCode?: ReasonCode;
  reasonDescription?: string;
  vatRate?: number;
  notes?: string;
  lines?: NoteLineInput[];
}

/**
 * Note List Filter
 */
export interface NoteListFilter {
  noteType?: NoteType;
  referenceType?: ReferenceType;
  status?: NoteStatus;
  customerId?: number;
  vendorId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Note List Response
 */
export interface NoteListResponse {
  data: CreditDebitNote[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Note Summary (for dashboard)
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
 * Invoice Reference (for selection)
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
  itemId?: number;
  itemCode?: string;
  itemName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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
