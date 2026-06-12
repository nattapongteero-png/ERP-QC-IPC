/**
 * Goods Receipt & Incoming Inspection — Types & Error Codes
 * Feature: 020-goods-receipt
 */

// ============================================
// Enums / unions
// ============================================

export type ChecklistCategory = 'raw_material' | 'finished_goods';
export const CHECKLIST_CATEGORIES: ChecklistCategory[] = ['raw_material', 'finished_goods'];

export type GrnSourceType = 'po' | 'wo';
export const GRN_SOURCE_TYPES: GrnSourceType[] = ['po', 'wo'];

export type GrnStatus =
  | 'in_progress'
  | 'released'
  | 'partially_released'
  | 'rejected'
  | 'cancelled';

export type GrnLineStatus =
  | 'created'
  | 'checklist_done'
  | 'qc_pending'
  | 'qc_approved'
  | 'released_to_stock'
  | 'rejected'
  | 'cancelled';

export const GRN_LINE_STATUSES: GrnLineStatus[] = [
  'created',
  'checklist_done',
  'qc_pending',
  'qc_approved',
  'released_to_stock',
  'rejected',
  'cancelled',
];

// State machine — allowed transitions for a line
export const GRN_LINE_TRANSITIONS: Record<GrnLineStatus, GrnLineStatus[]> = {
  created: ['checklist_done', 'cancelled'],
  checklist_done: ['qc_pending', 'rejected'],
  qc_pending: ['qc_approved', 'rejected'],
  qc_approved: ['released_to_stock', 'rejected'],
  released_to_stock: [],
  rejected: [],
  cancelled: [],
};

// ============================================
// Variance reasons (line-level)
// ============================================

export type VarianceFlag = 'quantity_variance' | 'yield_variance' | 'over_receipt' | 'expiry_too_short';

// ============================================
// Domain interfaces
// ============================================

export interface ChecklistItemDefinition {
  id: number;
  label: string;
  isMandatory: boolean;
  sortOrder: number;
}

export interface CapturedChecklistItem {
  templateItemId: number;
  label: string;
  isPass: boolean;
  remarks?: string | null;
}

export interface ChecklistTemplate {
  id: number;
  category: ChecklistCategory;
  version: number;
  isCurrent: boolean;
  items: ChecklistItemDefinition[];
  createdByUserId: number;
  createdAt: string;
}

export interface ReceiptTolerance {
  id: number;
  category: ChecklistCategory;
  tolerancePercent: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceipt {
  id: number;
  grnNumber: string;
  sourceType: GrnSourceType;
  poId: number | null;
  woId: number | null;
  vendorId: number | null;
  warehouseId: number;
  status: GrnStatus;
  receiverUserId: number;
  receivedDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptLine {
  id: number;
  grnId: number;
  lineNumber: number;
  itemId: number;
  /** Item master code + name, joined for display (null if item missing). */
  itemCode: string | null;
  itemName: string | null;
  expectedQuantity: number;
  actualQuantity: number | null;
  sampleQuantity: number | null;
  unit: string;
  vendorLotNumber: string | null;
  batchNumber: string | null;
  manufacturingDate: string | null;
  expiryDate: string | null;
  varianceAmount: number | null;
  variancePercent: number | null;
  varianceReason: string | null;
  status: GrnLineStatus;
  inventoryLotId: number | null;
  qcLotId: number | null;
  qcSampleId: number | null;
  qcSampleCreationFailed: boolean;
  receiverSignatureId: number | null;
  qaSignatureId: number | null;
  qaDecisionAt: string | null;
  rejectionReason: string | null;
  sourcePoLineId: number | null;
  sourceWoOutputId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptChecklist {
  id: number;
  lineId: number;
  templateId: number;
  templateVersion: number;
  category: ChecklistCategory;
  capturedItems: CapturedChecklistItem[];
  signedAt: string;
  signatureId: number;
  createdAt: string;
}

// Dashboard tile counts
export interface IncomingDashboardCounts {
  pendingChecklistCount: number;
  pendingQaCount: number;
  passedCount: number;
  rejectedCount: number;
  releasedTodayCount: number;
  quarantineAgingCount: number;
  staleQcSampleCount: number;
}

// ============================================
// Error codes (12 typed codes per plan R-section)
// ============================================

export const GOODS_RECEIPT_ERROR_CODES = {
  TRIPLE_INDEPENDENCE_VIOLATION: 'TRIPLE_INDEPENDENCE_VIOLATION',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  LOT_IN_QUARANTINE: 'LOT_IN_QUARANTINE',
  SOURCE_ALREADY_RECEIVED: 'SOURCE_ALREADY_RECEIVED',
  VARIANCE_NOT_JUSTIFIED: 'VARIANCE_NOT_JUSTIFIED',
  QC_NOT_APPROVED: 'QC_NOT_APPROVED',
  CHECKLIST_INCOMPLETE: 'CHECKLIST_INCOMPLETE',
  CANCELLATION_WINDOW_EXPIRED: 'CANCELLATION_WINDOW_EXPIRED',
  DUPLICATE_VENDOR_LOT: 'DUPLICATE_VENDOR_LOT',
  EXPIRY_TOO_SHORT: 'EXPIRY_TOO_SHORT',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_SOURCE: 'INVALID_SOURCE',
} as const;

export type GoodsReceiptErrorCode =
  (typeof GOODS_RECEIPT_ERROR_CODES)[keyof typeof GOODS_RECEIPT_ERROR_CODES];

export class GoodsReceiptError extends Error {
  constructor(
    public readonly code: GoodsReceiptErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GoodsReceiptError';
  }
}

// ============================================
// Input types for services
// ============================================

export interface CreateGrnInput {
  sourceType: GrnSourceType;
  poId?: number | null;
  woId?: number | null;
  warehouseId: number;
  receivedDate: string;
  notes?: string | null;
}

export interface UpdateGrnLineInput {
  actualQuantity?: number;
  vendorLotNumber?: string | null;
  batchNumber?: string | null;
  manufacturingDate?: string | null;
  expiryDate?: string | null;
  varianceReason?: string | null;
}

export interface SignChecklistInput {
  items: Array<{
    templateItemId: number;
    isPass: boolean;
    remarks?: string | null;
  }>;
  /** Quantity QC physically draws as a sample into the QC warehouse. */
  sampleQuantity: number;
  signature: {
    password?: string;
    pin?: string;
  };
}

export interface QaReleaseInput {
  /** Total quantity the warehouse actually counted on receipt. */
  actualQuantity: number;
  /** Optional override of the destination warehouse (defaults to the GRN's). */
  warehouseId?: number;
  signature: {
    password?: string;
    pin?: string;
  };
}

export interface QaActionInput {
  action: 'release' | 'reject';
  rejectionReason?: string;
  signature: {
    password?: string;
    pin?: string;
  };
}
