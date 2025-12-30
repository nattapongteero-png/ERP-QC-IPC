/**
 * 3-Way Matching Type Definitions (T101)
 * Part of 011-accounting-spec-gap - User Story 4
 *
 * 3-Way Matching validates:
 * 1. Purchase Order (PO) - what was ordered
 * 2. Goods Receipt Note (GRN) - what was received
 * 3. AP Invoice - what is being billed
 */

/**
 * Matching Tolerance Types
 */
export type ToleranceType =
  | 'quantity'      // Quantity variance (PO vs GRN vs Invoice)
  | 'price'         // Unit price variance
  | 'amount';       // Total amount variance

/**
 * Tolerance Calculation Method
 */
export type ToleranceMethod =
  | 'percentage'    // Variance as percentage
  | 'absolute';     // Fixed amount variance

/**
 * Matching Status
 */
export type MatchingStatus =
  | 'pending'       // Not yet matched
  | 'matched'       // Successfully matched within tolerance
  | 'exception'     // Variance exceeds tolerance
  | 'approved'      // Exception approved manually
  | 'rejected';     // Exception rejected

/**
 * Exception Status
 */
export type ExceptionStatus =
  | 'pending'       // Awaiting review
  | 'approved'      // Approved for payment
  | 'rejected';     // Rejected, requires correction

/**
 * Exception Type
 */
export type ExceptionType =
  | 'quantity_variance'   // Qty on invoice differs from PO/GRN
  | 'price_variance'      // Price on invoice differs from PO
  | 'amount_variance'     // Total amount variance
  | 'missing_grn'         // Invoice without GRN
  | 'missing_po'          // Invoice without PO
  | 'partial_receipt';    // Partial goods received

/**
 * Matching Tolerance Configuration
 */
export interface MatchingTolerance {
  id: number;
  name: string;
  description?: string | null;
  toleranceType: ToleranceType;
  toleranceMethod: ToleranceMethod;
  toleranceValue: number;       // Percentage or fixed amount
  currency?: string | null;     // For absolute tolerances
  itemCategoryId?: number | null;  // Apply to specific category
  vendorId?: number | null;     // Apply to specific vendor
  isActive: boolean;
  priority: number;             // Lower = higher priority
  createdBy: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Matching Result (Summary)
 */
export interface MatchingResult {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  poId?: number | null;
  poNumber?: string | null;
  grnId?: number | null;
  grnNumber?: string | null;
  vendorId: number;
  vendorName?: string;
  matchingStatus: MatchingStatus;
  matchedAt?: Date | string | null;
  matchedBy?: number | null;
  quantityVariance: number;     // Total quantity variance
  priceVariance: number;        // Total price variance
  amountVariance: number;       // Total amount variance
  exceptionCount: number;       // Number of exceptions
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Matching Result Line (Detail)
 */
export interface MatchingResultLine {
  id: number;
  resultId: number;
  invoiceLineId: number;
  poLineId?: number | null;
  grnLineId?: number | null;
  itemId?: number | null;
  itemCode?: string;
  itemName?: string;
  description: string;
  // PO values
  poQuantity?: number | null;
  poUnitPrice?: number | null;
  poLineTotal?: number | null;
  // GRN values
  grnQuantity?: number | null;
  // Invoice values
  invoiceQuantity: number;
  invoiceUnitPrice: number;
  invoiceLineTotal: number;
  // Variances
  quantityVariance: number;
  priceVariance: number;
  amountVariance: number;
  lineStatus: MatchingStatus;
  createdAt: Date | string;
}

/**
 * Matching Exception
 */
export interface MatchingException {
  id: number;
  resultId: number;
  resultLineId?: number | null;
  invoiceId: number;
  invoiceNumber: string;
  vendorId: number;
  vendorName?: string;
  exceptionType: ExceptionType;
  exceptionDescription: string;
  varianceAmount: number;
  toleranceApplied?: number | null;
  status: ExceptionStatus;
  reviewedBy?: number | null;
  reviewedByName?: string;
  reviewedAt?: Date | string | null;
  reviewComments?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * GR/IR Clearing Report Item
 */
export interface GRIRClearingItem {
  vendorId: number;
  vendorName: string;
  poId: number;
  poNumber: string;
  poDate: Date | string;
  itemId: number;
  itemCode: string;
  itemName: string;
  // PO values
  poQuantity: number;
  poUnitPrice: number;
  poTotal: number;
  // GRN values (total received)
  grnQuantity: number;
  grnTotal: number;
  // Invoice values (total invoiced)
  invoicedQuantity: number;
  invoicedTotal: number;
  // Status
  pendingQuantity: number;      // PO - GRN
  pendingInvoice: number;       // GRN - Invoiced
  clearingStatus: 'open' | 'partial' | 'cleared';
}

/**
 * GR/IR Clearing Report
 */
export interface GRIRClearingReport {
  asOfDate: Date | string;
  items: GRIRClearingItem[];
  summary: {
    totalPOValue: number;
    totalGRNValue: number;
    totalInvoicedValue: number;
    totalPendingReceipt: number;
    totalPendingInvoice: number;
    vendorCount: number;
    openItemCount: number;
  };
}

/**
 * Matching Request (input for running matching)
 */
export interface MatchingRequest {
  invoiceId: number;
  toleranceOverrides?: ToleranceOverride[];
}

/**
 * Tolerance Override (for specific matching request)
 */
export interface ToleranceOverride {
  toleranceType: ToleranceType;
  toleranceMethod: ToleranceMethod;
  toleranceValue: number;
}

/**
 * Create Tolerance Input
 */
export interface ToleranceCreateInput {
  name: string;
  description?: string;
  toleranceType: ToleranceType;
  toleranceMethod: ToleranceMethod;
  toleranceValue: number;
  currency?: string;
  itemCategoryId?: number;
  vendorId?: number;
  isActive?: boolean;
  priority?: number;
}

/**
 * Update Tolerance Input
 */
export interface ToleranceUpdateInput {
  name?: string;
  description?: string;
  toleranceValue?: number;
  isActive?: boolean;
  priority?: number;
}

/**
 * Tolerance List Filter
 */
export interface ToleranceListFilter {
  toleranceType?: ToleranceType;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Exception List Filter
 */
export interface ExceptionListFilter {
  status?: ExceptionStatus;
  exceptionType?: ExceptionType;
  vendorId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Matching Summary (for dashboard)
 */
export interface MatchingSummary {
  totalMatchedToday: number;
  totalExceptionsToday: number;
  pendingExceptions: number;
  matchedThisMonth: number;
  exceptionsByType: {
    quantity_variance: number;
    price_variance: number;
    amount_variance: number;
    missing_grn: number;
    missing_po: number;
    partial_receipt: number;
  };
}

/**
 * Exception Review Input
 */
export interface ExceptionReviewInput {
  exceptionId: number;
  approved: boolean;
  comments?: string;
}

/**
 * Matching Tolerance Option (for UI)
 */
export const TOLERANCE_TYPE_OPTIONS: { value: ToleranceType; label: string }[] = [
  { value: 'quantity', label: 'Quantity Tolerance' },
  { value: 'price', label: 'Price Tolerance' },
  { value: 'amount', label: 'Amount Tolerance' },
];

/**
 * Tolerance Method Option (for UI)
 */
export const TOLERANCE_METHOD_OPTIONS: { value: ToleranceMethod; label: string }[] = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'absolute', label: 'Fixed Amount' },
];

/**
 * Exception Type Option (for UI)
 */
export const EXCEPTION_TYPE_OPTIONS: { value: ExceptionType; label: string }[] = [
  { value: 'quantity_variance', label: 'Quantity Variance' },
  { value: 'price_variance', label: 'Price Variance' },
  { value: 'amount_variance', label: 'Amount Variance' },
  { value: 'missing_grn', label: 'Missing GRN' },
  { value: 'missing_po', label: 'Missing PO' },
  { value: 'partial_receipt', label: 'Partial Receipt' },
];
