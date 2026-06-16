/**
 * Type definitions for Primary Packaging Material Issuance & Return (feature 019).
 *
 * See spec at: specs/019-primary-packaging/spec.md
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const ISSUANCE_FLOW_STATUSES = ['pending_verification', 'issued', 'cancelled'] as const;
export type IssuanceFlowStatus = (typeof ISSUANCE_FLOW_STATUSES)[number];

export const RETURN_STATUSES = [
  'pending_qa_approval',
  'approved_reusable',
  'approved_quarantine',
  'rejected',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const PROPOSED_RETURN_STATUSES = ['reusable', 'quarantine', 'rejected'] as const;
export type ProposedReturnStatus = (typeof PROPOSED_RETURN_STATUSES)[number];

export const VARIANCE_REASONS = [
  'sampling',
  'spillage',
  'process_loss',
  'cleaning',
  'damaged',
  'unaccounted',
  'other',
] as const;
export type VarianceReason = (typeof VARIANCE_REASONS)[number];

export const PACKAGING_CATEGORIES = ['capsule', 'bottle', 'cap', 'label', 'blister', 'box', 'other'] as const;
export type PackagingCategory = (typeof PACKAGING_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Input DTOs
// ---------------------------------------------------------------------------

export interface CreateIssuanceInput {
  itemId: number;
  sourceLotId: number;
  quantity: number;
  containerLabel: string;
  roomId: number;
}

export interface VerifyIssuanceInput {
  password: string;
}

export interface CreateReturnInput {
  woPackagingMaterialId: number;
  usedQty: number;
  returnQty: number;
  varianceReason: VarianceReason;
  varianceExplanation?: string;
  returnContainerLabel: string;
  proposedStatus: ProposedReturnStatus;
}

export interface VerifyReturnInput {
  password: string;
}

export interface ApproveReturnInput {
  finalStatus: 'approved_reusable' | 'approved_quarantine' | 'rejected';
  overrideReason?: string;
  qaNotes?: string;
  password: string;
}

export interface RejectReturnInput {
  reason: string;
  password: string;
}

export interface CreateToleranceInput {
  packagingCategory: PackagingCategory;
  tolerancePercent: number;
  notes?: string;
}

export interface UpdateToleranceInput {
  tolerancePercent?: number;
  isActive?: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Read shapes
// ---------------------------------------------------------------------------

export interface IssuanceSummary {
  id: number;
  workOrderId: number;
  itemId: number;
  itemName?: string;
  itemCode?: string;
  quantity: number;
  unit: string;
  containerLabel: string | null;
  flowStatus: IssuanceFlowStatus;
  operator: { id: number; name: string };
  verifier: { id: number; name: string } | null;
  verifiedAt: string | null;
}

export interface IssuanceDetail extends IssuanceSummary {
  sourceLotId: number | null;
  sourceLotNumber?: string;
  roomId: number | null;
  roomName?: string;
  plannedQuantity: number;
  createdAt: string;
}

export interface ReturnSummary {
  id: number;
  woPackagingMaterialId: number;
  workOrderId?: number;
  itemId?: number;
  itemName?: string;
  usedQty: number;
  returnQty: number;
  varianceQty: number;
  variancePercent: number;
  outsideTolerance: boolean;
  status: ReturnStatus;
  proposedStatus: ProposedReturnStatus;
  returner: { id: number; name: string };
  verifier: { id: number; name: string } | null;
  submittedAt: string;
}

export interface ReturnDetail extends ReturnSummary {
  varianceReason: VarianceReason;
  varianceExplanation: string | null;
  returnContainerLabel: string;
  verifiedAt: string | null;
  approval: ReturnApprovalView | null;
}

export interface ReturnApprovalView {
  qaUserId: number;
  qaName?: string;
  finalStatus: 'approved_reusable' | 'approved_quarantine' | 'rejected';
  overrideReason: string | null;
  qaNotes: string | null;
  newLotId: number | null;
  deviationId: number | null;
  actionAt: string;
}

export interface PackagingTolerance {
  id: number;
  packagingCategory: PackagingCategory;
  tolerancePercent: number;
  isActive: boolean;
  notes: string | null;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export interface ReconciliationRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  packagingCategory: PackagingCategory;
  bomPlanned: number;
  issued: number;
  used: number;
  returned: number;
  varianceQty: number;
  variancePercent: number;
  tolerancePercent: number;
  withinTolerance: boolean;
  deviationIds: number[];
}

export interface ReconciliationReport {
  workOrderId: number;
  workOrderNumber?: string;
  generatedAt: string;
  rows: ReconciliationRow[];
  summary: {
    totalIssued: number;
    totalUsed: number;
    totalReturned: number;
    totalVariance: number;
    itemsOutsideTolerance: number;
  };
}

// ---------------------------------------------------------------------------
// Error codes (stable strings — used in service + API + i18n)
// ---------------------------------------------------------------------------

export const PACKAGING_ERROR_CODES = {
  // Issuance
  MATERIAL_NOT_IN_BOM: 'MATERIAL_NOT_IN_BOM',
  NOT_PACKAGING_TYPE: 'NOT_PACKAGING_TYPE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  WORK_ORDER_NOT_ACTIVE: 'WORK_ORDER_NOT_ACTIVE',
  CONTAINER_LABEL_REQUIRED: 'CONTAINER_LABEL_REQUIRED',
  ISSUANCE_NOT_PENDING: 'ISSUANCE_NOT_PENDING',
  // Return
  USED_EXCEEDS_ISSUED: 'USED_EXCEEDS_ISSUED',
  LOT_REJECTED_MUST_REJECT: 'LOT_REJECTED_MUST_REJECT',
  VARIANCE_EXPLANATION_REQUIRED: 'VARIANCE_EXPLANATION_REQUIRED',
  RETURN_NOT_PENDING_QA: 'RETURN_NOT_PENDING_QA',
  RETURN_NOT_VERIFIED: 'RETURN_NOT_VERIFIED',
  // Control
  DUAL_CONTROL_VIOLATION: 'DUAL_CONTROL_VIOLATION',
  TRIPLE_INDEPENDENCE_VIOLATION: 'TRIPLE_INDEPENDENCE_VIOLATION',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  OVERRIDE_REASON_REQUIRED: 'OVERRIDE_REASON_REQUIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type PackagingErrorCode = (typeof PACKAGING_ERROR_CODES)[keyof typeof PACKAGING_ERROR_CODES];

export class PackagingError extends Error {
  constructor(
    public readonly code: PackagingErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PackagingError';
  }
}
