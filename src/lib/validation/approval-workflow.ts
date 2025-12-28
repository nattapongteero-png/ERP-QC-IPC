/**
 * Approval Workflow Zod Validation Schemas (T009)
 * Part of 011-accounting-spec-gap
 */

import { z } from 'zod';

// Document types
export const documentTypeSchema = z.enum([
  'purchase_requisition',
  'purchase_order',
  'ap_invoice',
  'ar_invoice',
  'payment',
  'credit_note',
  'debit_note',
]);

// Rule operators
export const ruleOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'not_in',
]);

// Logic operators
export const logicOperatorSchema = z.enum(['and', 'or']);

// Approver types
export const approverTypeSchema = z.enum([
  'user',
  'role',
  'department_head',
  'requester_manager',
]);

// Approval request status
export const approvalRequestStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

// Approval request step status
export const approvalRequestStepStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'delegated',
  'timed_out',
]);

// Approval action
export const approvalActionSchema = z.enum(['approve', 'reject', 'delegate']);

// Approval Flow schemas
export const approvalFlowCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500).optional(),
  documentType: documentTypeSchema,
  priority: z.number().int().min(1).max(1000).default(100),
  isActive: z.boolean().default(true),
});

export const approvalFlowUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  documentType: documentTypeSchema.optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

// Approval Rule schemas
export const approvalRuleCreateSchema = z.object({
  flowId: z.number().int().positive(),
  ruleOrder: z.number().int().min(1),
  fieldName: z.string().min(1, 'Field name is required').max(50),
  operator: ruleOperatorSchema,
  value: z.string().min(1, 'Value is required').max(255),
  valueTo: z.string().max(255).optional(),
  logicOperator: logicOperatorSchema.default('and'),
}).refine(
  (data) => {
    // valueTo is required for 'between' operator
    if (data.operator === 'between' && !data.valueTo) {
      return false;
    }
    return true;
  },
  {
    message: 'valueTo is required for between operator',
    path: ['valueTo'],
  }
);

export const approvalRuleBulkCreateSchema = z.object({
  flowId: z.number().int().positive(),
  rules: z.array(z.object({
    ruleOrder: z.number().int().min(1),
    fieldName: z.string().min(1).max(50),
    operator: ruleOperatorSchema,
    value: z.string().min(1).max(255),
    valueTo: z.string().max(255).optional(),
    logicOperator: logicOperatorSchema.default('and'),
  })).min(1, 'At least one rule is required'),
});

// Approval Step schemas
export const approvalStepCreateSchema = z.object({
  flowId: z.number().int().positive(),
  stepOrder: z.number().int().min(1),
  stepName: z.string().min(1, 'Step name is required').max(100),
  approverType: approverTypeSchema,
  approverId: z.number().int().positive().optional(),
  canDelegate: z.boolean().default(false),
  timeoutDays: z.number().int().min(1).max(30).default(3),
  escalationStepId: z.number().int().positive().optional(),
}).refine(
  (data) => {
    // approverId is required for 'user' and 'role' types
    if ((data.approverType === 'user' || data.approverType === 'role') && !data.approverId) {
      return false;
    }
    return true;
  },
  {
    message: 'Approver ID is required for user or role type',
    path: ['approverId'],
  }
);

export const approvalStepBulkCreateSchema = z.object({
  flowId: z.number().int().positive(),
  steps: z.array(z.object({
    stepOrder: z.number().int().min(1),
    stepName: z.string().min(1).max(100),
    approverType: approverTypeSchema,
    approverId: z.number().int().positive().optional(),
    canDelegate: z.boolean().default(false),
    timeoutDays: z.number().int().min(1).max(30).default(3),
    escalationStepId: z.number().int().positive().optional(),
  })).min(1, 'At least one step is required'),
});

// Approval Request schemas
export const approvalSubmitSchema = z.object({
  documentType: documentTypeSchema,
  documentId: z.number().int().positive(),
  requestedBy: z.number().int().positive(),
  // Optional context data for rule evaluation
  context: z.object({
    totalAmount: z.number().optional(),
    departmentId: z.number().int().optional(),
    priority: z.string().optional(),
  }).optional(),
});

export const approvalRequestCreateSchema = z.object({
  flowId: z.number().int().positive(),
  documentType: documentTypeSchema,
  documentId: z.number().int().positive(),
  requestedBy: z.number().int().positive(),
});

// Approval Action schemas
export const approvalApproveSchema = z.object({
  comments: z.string().max(500).optional(),
});

export const approvalRejectSchema = z.object({
  comments: z.string().min(1, 'Rejection reason is required').max(500),
});

export const approvalDelegateSchema = z.object({
  delegateTo: z.number().int().positive('Delegate to employee ID is required'),
  comments: z.string().max(500).optional(),
});

// Approval Delegation schemas
export const approvalDelegationCreateSchema = z.object({
  delegatorId: z.number().int().positive(),
  delegateId: z.number().int().positive(),
  documentType: documentTypeSchema.optional(), // null for all types
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  isActive: z.boolean().default(true),
  reason: z.string().max(500).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  },
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  }
).refine(
  (data) => data.delegatorId !== data.delegateId,
  {
    message: 'Cannot delegate to self',
    path: ['delegateId'],
  }
);

export const approvalDelegationUpdateSchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

// Query schemas
export const approvalFlowQuerySchema = z.object({
  documentType: documentTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approvalRequestQuerySchema = z.object({
  documentType: documentTypeSchema.optional(),
  status: approvalRequestStatusSchema.optional(),
  requestedBy: z.coerce.number().int().optional(),
  assignedTo: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approvalDelegationQuerySchema = z.object({
  delegatorId: z.coerce.number().int().optional(),
  delegateId: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Type exports
export type ApprovalFlowCreate = z.infer<typeof approvalFlowCreateSchema>;
export type ApprovalFlowUpdate = z.infer<typeof approvalFlowUpdateSchema>;
export type ApprovalRuleCreate = z.infer<typeof approvalRuleCreateSchema>;
export type ApprovalRuleBulkCreate = z.infer<typeof approvalRuleBulkCreateSchema>;
export type ApprovalStepCreate = z.infer<typeof approvalStepCreateSchema>;
export type ApprovalStepBulkCreate = z.infer<typeof approvalStepBulkCreateSchema>;
export type ApprovalSubmit = z.infer<typeof approvalSubmitSchema>;
export type ApprovalRequestCreate = z.infer<typeof approvalRequestCreateSchema>;
export type ApprovalApprove = z.infer<typeof approvalApproveSchema>;
export type ApprovalReject = z.infer<typeof approvalRejectSchema>;
export type ApprovalDelegate = z.infer<typeof approvalDelegateSchema>;
export type ApprovalDelegationCreate = z.infer<typeof approvalDelegationCreateSchema>;
export type ApprovalDelegationUpdate = z.infer<typeof approvalDelegationUpdateSchema>;
export type ApprovalFlowQuery = z.infer<typeof approvalFlowQuerySchema>;
export type ApprovalRequestQuery = z.infer<typeof approvalRequestQuerySchema>;
export type ApprovalDelegationQuery = z.infer<typeof approvalDelegationQuerySchema>;
