/**
 * Type definitions for Material Withdrawal Approval (feature 018).
 *
 * See spec at: specs/018-material-withdrawal-approval/spec.md
 */

// Status flow: pending -> approved -> released | rejected | cancelled
//   pending   = operator submitted, awaiting supervisor
//   approved  = supervisor e-signed (authorization recorded) — NO stock movement yet, awaiting warehouse
//   released  = warehouse released the goods — stock deducted (terminal success)
export const WITHDRAWAL_STATUSES = ['pending', 'approved', 'released', 'rejected', 'cancelled'] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

export const WITHDRAWAL_REASON_TYPES = [
  'machine_setup_loss',
  'equipment_trial_run',
  'parameter_adjustment',
  'other',
] as const;
export type WithdrawalReasonType = (typeof WITHDRAWAL_REASON_TYPES)[number];

export const WITHDRAWAL_APPROVAL_ACTIONS = ['approve', 'reject'] as const;
export type WithdrawalApprovalAction = (typeof WITHDRAWAL_APPROVAL_ACTIONS)[number];

export const MATERIAL_CATEGORIES = [
  'active_ingredient',
  'excipient',
  'packaging',
  'other',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface MaterialWithdrawalRequestItemInput {
  materialId: number;
  quantityRequested: number;
  unit: string;
}

export interface CreateMaterialWithdrawalRequestInput {
  workOrderId: number;
  items: MaterialWithdrawalRequestItemInput[];
  reasonType: WithdrawalReasonType;
  reasonDetail?: string;
  machinePhase?: string;
  roomId: number;
  attachmentIds?: number[];
  factoryCode?: string | null;
}

export interface ApproveMaterialWithdrawalRequestInput {
  approvedItems?: { itemId: number; quantityApproved: number }[];
  comment?: string;
  password: string;
}

/** Warehouse release of a supervisor-approved request — deducts stock. */
export interface ReleaseMaterialWithdrawalRequestInput {
  comment?: string;
}

export interface RejectMaterialWithdrawalRequestInput {
  reason: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Read shapes (returned to API clients / UI)
// ---------------------------------------------------------------------------

export interface MaterialWithdrawalRequestSummary {
  id: number;
  workOrderId: number;
  workOrderNumber?: string;
  productName?: string | null;
  productCode?: string | null;
  factoryCode: string | null;
  status: WithdrawalStatus;
  reasonType: WithdrawalReasonType;
  requestedAt: string;
  requestedBy: { id: number; name: string };
  itemCount: number;
}

export interface MaterialWithdrawalRequestItem {
  id: number;
  materialId: number;
  materialName?: string;
  materialCode?: string;
  quantityRequested: number;
  quantityApproved: number | null;
  unit: string;
  bomPlannedQuantity: number;
  cumulativeExtraAfterApprove: number | null;
  /** On-hand quantity available across lots (so the approver sees if enough). */
  availableQty?: number;
}

export interface MaterialWithdrawalAttachment {
  id: number;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MaterialWithdrawalApproval {
  approverUserId: number;
  approverName?: string;
  action: WithdrawalApprovalAction;
  actionAt: string;
  reason: string | null;
  comment?: string | null;
  signatureId: number;
}

export interface MaterialWithdrawalRequestDetail extends MaterialWithdrawalRequestSummary {
  reasonDetail: string | null;
  machinePhase: string | null;
  roomId: number;
  roomName?: string;
  items: MaterialWithdrawalRequestItem[];
  attachments: MaterialWithdrawalAttachment[];
  approval: MaterialWithdrawalApproval | null;
  /** Warehouse release audit (set once status = 'released'). */
  releasedAt?: string | null;
  releasedBy?: { id: number; name: string } | null;
}

// ---------------------------------------------------------------------------
// Rule lookup
// ---------------------------------------------------------------------------

export interface MaterialWithdrawalRule {
  id: number;
  factoryCode: string | null;
  materialCategory: MaterialCategory | null;
  softCapPercent: number;
  hardCapPercent: number;
  isActive: boolean;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResolvedCapRule extends MaterialWithdrawalRule {
  /** Specificity path used for the lookup (most-specific first). */
  resolutionPath: string[];
}

// ---------------------------------------------------------------------------
// Phase blocking (FR-035..040)
// ---------------------------------------------------------------------------

export interface BlockedPhase {
  phaseId: number;
  phaseName: string;
  blockedReason: string;
  pendingRequestIds: number[];
  affectedMaterials: { materialId: number; materialName: string }[];
}

// ---------------------------------------------------------------------------
// List filters
// ---------------------------------------------------------------------------

export interface MaterialWithdrawalListFilters {
  workOrderId?: number;
  factoryCode?: string | null;
  status?: WithdrawalStatus;
  reasonType?: WithdrawalReasonType;
  dateFrom?: string;
  dateTo?: string;
  requestedBy?: number;
  page?: number;
  pageSize?: number;
}

export interface PaginatedRequests {
  items: MaterialWithdrawalRequestSummary[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Service-layer error codes (stable strings — used in tests + API + i18n)
// ---------------------------------------------------------------------------

export const WITHDRAWAL_ERROR_CODES = {
  MATERIAL_NOT_IN_BOM: 'MATERIAL_NOT_IN_BOM',
  PHASE_REQUIRED: 'PHASE_REQUIRED',
  REASON_DETAIL_REQUIRED: 'REASON_DETAIL_REQUIRED',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  EXCEEDS_HARD_CAP: 'EXCEEDS_HARD_CAP',
  REQUEST_NOT_PENDING: 'REQUEST_NOT_PENDING',
  REQUEST_NOT_APPROVED: 'REQUEST_NOT_APPROVED',
  DUAL_CONTROL_VIOLATION: 'DUAL_CONTROL_VIOLATION',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  WORK_ORDER_NOT_ACTIVE: 'WORK_ORDER_NOT_ACTIVE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ATTACHMENT_TOO_LARGE: 'ATTACHMENT_TOO_LARGE',
  TOO_MANY_ATTACHMENTS: 'TOO_MANY_ATTACHMENTS',
} as const;

export type WithdrawalErrorCode =
  (typeof WITHDRAWAL_ERROR_CODES)[keyof typeof WITHDRAWAL_ERROR_CODES];

export class MaterialWithdrawalError extends Error {
  constructor(
    public readonly code: WithdrawalErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MaterialWithdrawalError';
  }
}
