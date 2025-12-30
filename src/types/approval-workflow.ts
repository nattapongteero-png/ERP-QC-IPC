/**
 * Approval Workflow Type Definitions (T008)
 * Part of 011-accounting-spec-gap
 */

// Approval Flow - defines the workflow template
export interface ApprovalFlowInput {
  name: string;
  description?: string;
  documentType: DocumentType;
  priority?: number;
  isActive?: boolean;
}

export interface ApprovalFlowUpdate extends Partial<ApprovalFlowInput> {
  id: number;
}

// Document types that can go through approval workflows
export type DocumentType =
  | 'purchase_requisition'
  | 'purchase_order'
  | 'ap_invoice'
  | 'ar_invoice'
  | 'payment'
  | 'credit_note'
  | 'debit_note';

// Approval Rule - conditions that trigger flow steps
export interface ApprovalRuleInput {
  flowId: number;
  ruleOrder: number;
  fieldName: string; // e.g., 'total_amount', 'department_id', 'priority'
  operator: RuleOperator;
  value: string;
  valueTo?: string; // For 'between' operator
  logicOperator?: LogicOperator;
}

export type RuleOperator =
  | 'eq'      // equals
  | 'ne'      // not equals
  | 'gt'      // greater than
  | 'gte'     // greater than or equal
  | 'lt'      // less than
  | 'lte'     // less than or equal
  | 'between' // between value and valueTo
  | 'in'      // in list (comma-separated values)
  | 'not_in'; // not in list

export type LogicOperator = 'and' | 'or';

// Approval Step - defines who approves at each stage
export interface ApprovalStepInput {
  flowId: number;
  stepOrder: number;
  stepName: string;
  approverType: ApproverType;
  approverId?: number; // User ID or Role ID depending on approverType
  canDelegate?: boolean;
  timeoutDays?: number;
  escalationStepId?: number;
}

export type ApproverType =
  | 'user'              // Specific user
  | 'role'              // Any user with this role
  | 'department_head'   // Head of requester's department
  | 'requester_manager'; // Direct manager of requester

// Approval Request - an instance of approval for a specific document
export interface ApprovalRequestInput {
  flowId: number;
  documentType: DocumentType;
  documentId: number;
  requestedBy: number; // Employee ID
}

export interface ApprovalRequestUpdate {
  id: number;
  status?: ApprovalRequestStatus;
  currentStepOrder?: number;
  completedAt?: string;
}

export type ApprovalRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled';

// Approval Request Step - individual step instance
export interface ApprovalRequestStepInput {
  requestId: number;
  stepId: number;
  stepOrder: number;
  assignedTo: number; // Employee ID
  delegatedFrom?: number; // Employee ID if delegated
}

export interface ApprovalActionInput {
  requestId: number;
  stepId: number;
  action: ApprovalAction;
  comments?: string;
}

export type ApprovalAction = 'approve' | 'reject' | 'delegate';

export type ApprovalRequestStepStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'delegated'
  | 'timed_out';

// Approval Delegation - temporary delegation of approval authority
export interface ApprovalDelegationInput {
  delegatorId: number; // Employee ID delegating authority
  delegateId: number;  // Employee ID receiving authority
  documentType?: DocumentType; // null means all document types
  startDate: string;
  endDate: string;
  isActive?: boolean;
  reason?: string;
}

// Response types for API
export interface ApprovalFlowWithDetails {
  id: number;
  name: string;
  description: string | null;
  documentType: DocumentType;
  priority: number;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  rules: ApprovalRuleDetail[];
  steps: ApprovalStepDetail[];
}

export interface ApprovalRuleDetail {
  id: number;
  flowId: number;
  ruleOrder: number;
  fieldName: string;
  operator: RuleOperator;
  value: string;
  valueTo: string | null;
  logicOperator: LogicOperator;
  createdAt: string;
}

export interface ApprovalStepDetail {
  id: number;
  flowId: number;
  stepOrder: number;
  stepName: string;
  approverType: ApproverType;
  approverId: number | null;
  canDelegate: boolean;
  timeoutDays: number;
  escalationStepId: number | null;
  createdAt: string;
}

export interface ApprovalRequestWithDetails {
  id: number;
  flowId: number;
  documentType: DocumentType;
  documentId: number;
  currentStepOrder: number;
  status: ApprovalRequestStatus;
  requestedBy: number;
  requestedAt: string;
  completedAt: string | null;
  createdAt: string;
  flow: {
    id: number;
    name: string;
  };
  steps: ApprovalRequestStepDetail[];
  document?: DocumentInfo;
}

export interface ApprovalRequestStepDetail {
  id: number;
  requestId: number;
  stepId: number;
  stepOrder: number;
  assignedTo: number;
  assignedToName?: string;
  delegatedFrom: number | null;
  delegatedFromName?: string;
  status: ApprovalRequestStepStatus;
  actionDate: string | null;
  comments: string | null;
  createdAt: string;
}

export interface DocumentInfo {
  id: number;
  number: string; // Document number (e.g., PR-001, PO-001)
  description?: string;
  totalAmount?: number;
  status: string;
}

// Dashboard types
export interface ApprovalDashboard {
  pendingCount: number;
  approvedTodayCount: number;
  rejectedTodayCount: number;
  pendingRequests: ApprovalRequestWithDetails[];
  recentActions: RecentApprovalAction[];
}

export interface RecentApprovalAction {
  id: number;
  documentType: DocumentType;
  documentNumber: string;
  action: ApprovalAction;
  actionBy: string;
  actionDate: string;
  comments: string | null;
}

// Workflow evaluation types
export interface DocumentContext {
  documentType: DocumentType;
  documentId: number;
  totalAmount?: number;
  departmentId?: number;
  priority?: string;
  requesterId: number;
  [key: string]: unknown; // Allow additional context fields
}

export interface FlowEvaluationResult {
  matched: boolean;
  flowId: number | null;
  flowName: string | null;
  steps: ApprovalStepDetail[];
}

// Error types
export interface ApprovalWorkflowError {
  code: 'NO_MATCHING_FLOW' | 'INVALID_STEP' | 'NOT_AUTHORIZED' | 'ALREADY_PROCESSED' | 'VALIDATION_ERROR';
  message: string;
}

// UI Rule Builder types (T123)
export type RuleField =
  | 'amount'
  | 'department'
  | 'costCenter'
  | 'project'
  | 'vendor'
  | 'customer'
  | 'category';

// Extended operator type for UI (maps to DB operators internally)
export type UIRuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'contains';

// Re-export RuleOperator to include UI operators for the rule builder
export type RuleOperatorExtended = RuleOperator | UIRuleOperator;

// ApprovalRule for UI components
export interface ApprovalRule {
  id?: number;
  flowId: number;
  field: RuleField;
  operator: UIRuleOperator;
  value: string;
  valueSecondary?: string;
  priority: number;
  createdAt: string;
}
