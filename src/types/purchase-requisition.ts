/**
 * Purchase Requisition Type Definitions (T031)
 * Part of 011-accounting-spec-gap
 */

/**
 * Purchase Requisition Status
 */
export type PRStatus =
  | 'draft'           // Initial state, editable
  | 'submitted'       // Submitted for approval
  | 'pending_approval' // Waiting for approver action
  | 'approved'        // Fully approved, ready for PO conversion
  | 'rejected'        // Rejected by approver
  | 'cancelled'       // Cancelled by requester
  | 'converted';      // Converted to PO

/**
 * Priority Level for Purchase Requisitions
 */
export type PRPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Line Item Status
 */
export type PRLineStatus =
  | 'pending'         // Waiting for processing
  | 'approved'        // Approved line
  | 'rejected'        // Rejected line
  | 'partial_po'      // Partially converted to PO
  | 'full_po';        // Fully converted to PO

/**
 * Purchase Requisition Header Input for Creation
 */
export interface PRCreateInput {
  requesterId: number;
  departmentId?: number;
  priority?: PRPriority;
  requiredDate?: string;
  description?: string;
  justification?: string;
  costCenterId?: number;
  projectId?: number;
}

/**
 * Purchase Requisition Header Input for Update
 */
export interface PRUpdateInput {
  priority?: PRPriority;
  requiredDate?: string;
  description?: string;
  justification?: string;
  costCenterId?: number;
  projectId?: number;
}

/**
 * Purchase Requisition Line Item Input
 */
export interface PRLineInput {
  id?: number;             // Line ID (present when editing existing lines)
  itemId?: number;         // Reference to inventory item (optional for service)
  itemCode?: string;       // Manual item code
  description: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedUnitPrice?: number;
  suggestedVendorId?: number;
  notes?: string;
}

/**
 * Purchase Requisition Header
 */
export interface PurchaseRequisition {
  id: number;
  prNumber: string;
  requesterId: number;
  requesterName?: string;
  departmentId?: number;
  departmentName?: string;
  status: PRStatus;
  priority: PRPriority;
  requiredDate?: Date | string | null;
  description?: string | null;
  justification?: string | null;
  costCenterId?: number | null;
  projectId?: number | null;
  totalAmount: number;
  approvalRequestId?: number | null;
  // createdBy = the user account that recorded the PR (distinct from
  // requesterId, the HR employee on whose behalf it was raised).
  createdBy?: number | null;
  createdByName?: string;
  approvedBy?: number | null;
  approvedByName?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  submittedAt?: Date | string | null;
  approvedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  rejectionReason?: string | null;
}

/**
 * A single step in the PR action timeline shown on the detail page —
 * who did what, when. Covers creation + every approval-workflow step.
 */
export interface PRTimelineEntry {
  // 'created' is synthesised from the PR row; the rest come from
  // approval_request_steps (status: approved | rejected | pending | …).
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'pending';
  stepOrder: number | null;
  stepName: string;
  actorName: string;          // who performed (or is assigned to) the step
  delegatedFromName?: string; // set when the step was approved on someone's behalf
  actionDate?: Date | string | null;
  comments?: string | null;
}

/**
 * Purchase Requisition Line Item
 */
export interface PurchaseRequisitionLine {
  id: number;
  prId: number;
  lineNumber: number;
  itemId?: number | null;
  itemCode?: string | null;
  description: string;
  quantity: number;
  unitOfMeasure: string;
  estimatedUnitPrice: number;
  estimatedAmount: number;
  suggestedVendorId?: number | null;
  suggestedVendorName?: string | null;
  notes?: string | null;
  status: PRLineStatus;
  convertedPoId?: number | null;
  convertedPoLineId?: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Purchase Requisition with Lines
 */
export interface PRWithLines extends PurchaseRequisition {
  lines: PurchaseRequisitionLine[];
}

/**
 * PR List Filter Options
 */
export interface PRListFilter {
  status?: PRStatus;
  priority?: PRPriority;
  requesterId?: number;
  departmentId?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * PR List Response
 */
export interface PRListResponse {
  data: PurchaseRequisition[];
  total: number;
  page: number;
  limit: number;
}

/**
 * PR Submit Response
 */
export interface PRSubmitResponse {
  success: boolean;
  prId: number;
  prNumber: string;
  approvalRequestId: number;
  flowName: string;
}

/**
 * PR to PO Conversion Input
 */
export interface PRToPOConvertInput {
  prId: number;
  lineIds?: number[];      // Specific lines to convert (empty = all approved lines)
  vendorId: number;        // Target vendor for PO
  deliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
}

/**
 * PR to PO Conversion Response
 */
export interface PRToPOConvertResponse {
  success: boolean;
  poId: number;
  poNumber: string;
  convertedLineCount: number;
}

/**
 * PR Approval Action Input
 */
export interface PRApprovalInput {
  action: 'approve' | 'reject';
  comments?: string;
  lineApprovals?: {        // Optional per-line approval
    lineId: number;
    approved: boolean;
    comments?: string;
  }[];
}

/**
 * PR Dashboard Summary
 */
export interface PRDashboardSummary {
  draftCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalThisMonth: number;
  avgProcessingDays: number;
  urgentPending: number;
}

/**
 * PR Approval History Entry
 */
export interface PRApprovalHistoryEntry {
  stepOrder: number;
  stepName: string;
  approverName: string;
  action: 'approved' | 'rejected' | 'pending';
  comments?: string;
  actionDate?: Date | string;
}
