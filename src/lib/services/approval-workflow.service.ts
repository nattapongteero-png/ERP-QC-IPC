/**
 * Approval Workflow Service (T010-T012)
 * Part of 011-accounting-spec-gap
 *
 * Provides CRUD operations for approval flows, rules, steps,
 * and handles approval request submission, evaluation, and actions.
 */

import { eq, and, desc, asc, gte, lte, isNull, or, sql } from 'drizzle-orm';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toQueryDate, getTodayStr } from '../db/date-utils';
import type {
  DocumentType,
  ApprovalFlowInput,
  ApprovalFlowUpdate,
  ApprovalRuleInput,
  ApprovalStepInput,
  ApprovalFlowWithDetails,
  ApprovalRuleDetail,
  ApprovalStepDetail,
  ApprovalRequestWithDetails,
  ApprovalRequestStepDetail,
  DocumentContext,
  FlowEvaluationResult,
  ApprovalDashboard,
  RecentApprovalAction,
  ApprovalRequestStatus,
  ApprovalRequestStepStatus,
  RuleOperator,
} from '@/types/approval-workflow';

// ============================================
// Table References
// ============================================

function getTables() {
  return {
    flows: getTableRef('approvalFlows'),
    rules: getTableRef('approvalRules'),
    steps: getTableRef('approvalSteps'),
    requests: getTableRef('approvalRequests'),
    requestSteps: getTableRef('approvalRequestSteps'),
    delegations: getTableRef('approvalDelegations'),
    employees: getTableRef('HREmployees'),
    users: getTableRef('users'),
  };
}

// ============================================
// Approval Flow CRUD (T010)
// ============================================

/**
 * Create a new approval flow
 */
export async function createApprovalFlow(
  data: ApprovalFlowInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.flows).values({
      name: data.name,
      description: data.description || null,
      documentType: data.documentType,
      priority: data.priority ?? 100,
      isActive: data.isActive ?? true,
      createdBy,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    return getInsertId(result);
  });
}

/**
 * Get approval flow by ID with rules and steps
 */
export async function getApprovalFlowById(
  id: number
): Promise<ApprovalFlowWithDetails | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [flow] = await db
      .select()
      .from(tables.flows)
      .where(eq(tables.flows.id, id));

    if (!flow) return null;

    const rules = await db
      .select()
      .from(tables.rules)
      .where(eq(tables.rules.flowId, id))
      .orderBy(asc(tables.rules.ruleOrder));

    const steps = await db
      .select()
      .from(tables.steps)
      .where(eq(tables.steps.flowId, id))
      .orderBy(asc(tables.steps.stepOrder));

    return {
      ...flow,
      rules: rules as ApprovalRuleDetail[],
      steps: steps as ApprovalStepDetail[],
    } as ApprovalFlowWithDetails;
  });
}

/**
 * List approval flows with optional filtering
 */
export async function listApprovalFlows(options: {
  documentType?: DocumentType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ data: ApprovalFlowWithDetails[]; total: number }> {
  const { documentType, isActive, page = 1, limit = 20 } = options;

  return executeDbOperation(async (db) => {
    const tables = getTables();
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (documentType) {
      conditions.push(eq(tables.flows.documentType, documentType));
    }
    if (isActive !== undefined) {
      conditions.push(eq(tables.flows.isActive, isActive));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get flows
    const flows = await db
      .select()
      .from(tables.flows)
      .where(whereClause)
      .orderBy(asc(tables.flows.priority), desc(tables.flows.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.flows)
      .where(whereClause);

    // Get rules and steps for each flow
    const flowsWithDetails = await Promise.all(
      flows.map(async (flow: { id: number; name: string; description: string | null; documentType: string; priority: number; isActive: boolean; createdBy: number; createdAt: Date | string; updatedAt: Date | string }) => {
        const rules = await db
          .select()
          .from(tables.rules)
          .where(eq(tables.rules.flowId, flow.id))
          .orderBy(asc(tables.rules.ruleOrder));

        const steps = await db
          .select()
          .from(tables.steps)
          .where(eq(tables.steps.flowId, flow.id))
          .orderBy(asc(tables.steps.stepOrder));

        return {
          ...flow,
          rules: rules as ApprovalRuleDetail[],
          steps: steps as ApprovalStepDetail[],
        } as ApprovalFlowWithDetails;
      })
    );

    return {
      data: flowsWithDetails,
      total: Number(countResult?.count || 0),
    };
  });
}

/**
 * Update approval flow
 */
export async function updateApprovalFlow(
  id: number,
  data: Partial<ApprovalFlowInput>
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .update(tables.flows)
      .set({
        ...data,
        updatedAt: getNow(),
      })
      .where(eq(tables.flows.id, id));
  });
}

/**
 * Delete approval flow (and cascade to rules/steps)
 */
export async function deleteApprovalFlow(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Delete rules first
    await db.delete(tables.rules).where(eq(tables.rules.flowId, id));

    // Delete steps
    await db.delete(tables.steps).where(eq(tables.steps.flowId, id));

    // Delete flow
    await db.delete(tables.flows).where(eq(tables.flows.id, id));
  });
}

// ============================================
// Approval Rules CRUD
// ============================================

/**
 * Add rules to a flow
 */
export async function addApprovalRules(
  rules: Omit<ApprovalRuleInput, 'flowId'>[],
  flowId: number
): Promise<number[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const ids: number[] = [];

    for (const rule of rules) {
      const result = await db.insert(tables.rules).values({
        flowId,
        ruleOrder: rule.ruleOrder,
        fieldName: rule.fieldName,
        operator: rule.operator,
        value: rule.value,
        valueTo: rule.valueTo || null,
        logicOperator: rule.logicOperator || 'and',
        createdAt: getNow(),
      });
      ids.push(getInsertId(result));
    }

    return ids;
  });
}

/**
 * Replace all rules for a flow
 */
export async function replaceApprovalRules(
  flowId: number,
  rules: Omit<ApprovalRuleInput, 'flowId'>[]
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Delete existing rules
    await db.delete(tables.rules).where(eq(tables.rules.flowId, flowId));

    // Insert new rules
    for (const rule of rules) {
      await db.insert(tables.rules).values({
        flowId,
        ruleOrder: rule.ruleOrder,
        fieldName: rule.fieldName,
        operator: rule.operator,
        value: rule.value,
        valueTo: rule.valueTo || null,
        logicOperator: rule.logicOperator || 'and',
        createdAt: getNow(),
      });
    }
  });
}

// ============================================
// Approval Steps CRUD
// ============================================

/**
 * Add steps to a flow
 */
export async function addApprovalSteps(
  steps: Omit<ApprovalStepInput, 'flowId'>[],
  flowId: number
): Promise<number[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const ids: number[] = [];

    for (const step of steps) {
      const result = await db.insert(tables.steps).values({
        flowId,
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        approverType: step.approverType,
        approverId: step.approverId || null,
        canDelegate: step.canDelegate ?? false,
        timeoutDays: step.timeoutDays ?? 3,
        escalationStepId: step.escalationStepId || null,
        createdAt: getNow(),
      });
      ids.push(getInsertId(result));
    }

    return ids;
  });
}

/**
 * Replace all steps for a flow
 */
export async function replaceApprovalSteps(
  flowId: number,
  steps: Omit<ApprovalStepInput, 'flowId'>[]
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Delete existing steps
    await db.delete(tables.steps).where(eq(tables.steps.flowId, flowId));

    // Insert new steps
    for (const step of steps) {
      await db.insert(tables.steps).values({
        flowId,
        stepOrder: step.stepOrder,
        stepName: step.stepName,
        approverType: step.approverType,
        approverId: step.approverId || null,
        canDelegate: step.canDelegate ?? false,
        timeoutDays: step.timeoutDays ?? 3,
        escalationStepId: step.escalationStepId || null,
        createdAt: getNow(),
      });
    }
  });
}

// ============================================
// Rule Evaluation (T011)
// ============================================

/**
 * Evaluate a single rule against document context
 */
function evaluateRule(rule: ApprovalRuleDetail, context: DocumentContext): boolean {
  const fieldValue = context[rule.fieldName];
  const ruleValue = rule.value;
  const ruleValueTo = rule.valueTo;

  // Handle null/undefined field values
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }

  const operator = rule.operator as RuleOperator;

  switch (operator) {
    case 'eq':
      return String(fieldValue) === ruleValue;
    case 'ne':
      return String(fieldValue) !== ruleValue;
    case 'gt':
      return Number(fieldValue) > Number(ruleValue);
    case 'gte':
      return Number(fieldValue) >= Number(ruleValue);
    case 'lt':
      return Number(fieldValue) < Number(ruleValue);
    case 'lte':
      return Number(fieldValue) <= Number(ruleValue);
    case 'between':
      return (
        Number(fieldValue) >= Number(ruleValue) &&
        Number(fieldValue) <= Number(ruleValueTo)
      );
    case 'in':
      const inValues = ruleValue.split(',').map((v) => v.trim());
      return inValues.includes(String(fieldValue));
    case 'not_in':
      const notInValues = ruleValue.split(',').map((v) => v.trim());
      return !notInValues.includes(String(fieldValue));
    default:
      return false;
  }
}

/**
 * Evaluate all rules for a flow
 */
function evaluateFlowRules(
  rules: ApprovalRuleDetail[],
  context: DocumentContext
): boolean {
  if (rules.length === 0) {
    return true; // No rules means always match
  }

  let result = true;
  let currentLogic: 'and' | 'or' = 'and';

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const ruleResult = evaluateRule(rule, context);

    if (i === 0) {
      result = ruleResult;
    } else {
      if (currentLogic === 'and') {
        result = result && ruleResult;
      } else {
        result = result || ruleResult;
      }
    }

    // Prepare for next iteration
    currentLogic = rule.logicOperator as 'and' | 'or';
  }

  return result;
}

/**
 * Find matching approval flow for a document
 */
export async function findMatchingFlow(
  context: DocumentContext
): Promise<FlowEvaluationResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get active flows for this document type, ordered by priority
    const flows = await db
      .select()
      .from(tables.flows)
      .where(
        and(
          eq(tables.flows.documentType, context.documentType),
          eq(tables.flows.isActive, true)
        )
      )
      .orderBy(asc(tables.flows.priority));

    for (const flow of flows) {
      // Get rules for this flow
      const rules = await db
        .select()
        .from(tables.rules)
        .where(eq(tables.rules.flowId, flow.id))
        .orderBy(asc(tables.rules.ruleOrder));

      // Evaluate rules
      if (evaluateFlowRules(rules as ApprovalRuleDetail[], context)) {
        // Get steps for this flow
        const steps = await db
          .select()
          .from(tables.steps)
          .where(eq(tables.steps.flowId, flow.id))
          .orderBy(asc(tables.steps.stepOrder));

        return {
          matched: true,
          flowId: flow.id,
          flowName: flow.name,
          steps: steps as ApprovalStepDetail[],
        };
      }
    }

    return {
      matched: false,
      flowId: null,
      flowName: null,
      steps: [],
    };
  });
}

// ============================================
// Approval Request Submission (T011)
// ============================================

/**
 * Submit document for approval
 */
export async function submitForApproval(
  context: DocumentContext
): Promise<{ requestId: number; flowName: string }> {
  // Find matching flow
  const flowResult = await findMatchingFlow(context);

  if (!flowResult.matched || !flowResult.flowId) {
    throw new Error('NO_MATCHING_FLOW: No approval workflow configured for this document type and criteria');
  }

  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Create approval request
    const requestResult = await db.insert(tables.requests).values({
      flowId: flowResult.flowId,
      documentType: context.documentType,
      documentId: context.documentId,
      currentStepOrder: 1,
      status: 'pending',
      requestedBy: context.requesterId,
      requestedAt: getNow(),
      createdAt: getNow(),
    });
    const requestId = getInsertId(requestResult);

    // Create request steps for each step in the flow
    for (const step of flowResult.steps) {
      const assignedTo = await resolveApprover(step, context.requesterId);

      await db.insert(tables.requestSteps).values({
        requestId,
        stepId: step.id,
        stepOrder: step.stepOrder,
        assignedTo,
        status: step.stepOrder === 1 ? 'pending' : 'pending',
        createdAt: getNow(),
      });
    }

    return {
      requestId,
      flowName: flowResult.flowName!,
    };
  });
}

/**
 * Resolve the approver for a step
 */
async function resolveApprover(
  step: ApprovalStepDetail,
  requesterId: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    switch (step.approverType) {
      case 'user':
        // Direct user assignment
        return step.approverId!;

      case 'role':
        // Find first user with this role (simplified - in production would pick based on workload)
        const [roleUser] = await db
          .select({ employeeId: tables.employees.id })
          .from(tables.employees)
          .where(eq(tables.employees.isActive, true))
          .limit(1);
        return roleUser?.employeeId ?? step.approverId!;

      case 'department_head':
        // Find department head of requester
        const [requester] = await db
          .select({ departmentId: tables.employees.departmentId })
          .from(tables.employees)
          .where(eq(tables.employees.id, requesterId));

        if (requester?.departmentId) {
          // Get department head (simplified - would query org structure)
          const [deptHead] = await db
            .select({ id: tables.employees.id })
            .from(tables.employees)
            .where(
              and(
                eq(tables.employees.departmentId, requester.departmentId),
                eq(tables.employees.isActive, true)
              )
            )
            .limit(1);
          if (deptHead) return deptHead.id;
        }
        return step.approverId ?? requesterId;

      case 'requester_manager':
        // Find requester's direct manager
        const [emp] = await db
          .select({ managerId: tables.employees.managerId })
          .from(tables.employees)
          .where(eq(tables.employees.id, requesterId));
        return emp?.managerId ?? step.approverId ?? requesterId;

      default:
        return step.approverId ?? requesterId;
    }
  });
}

// ============================================
// Approval Actions (T012)
// ============================================

/**
 * Approve a request step
 */
export async function approveRequest(
  requestId: number,
  approverId: number,
  comments?: string
): Promise<{ isFullyApproved: boolean }> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get request
    const [request] = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId));

    if (!request) {
      throw new Error('INVALID_REQUEST: Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('ALREADY_PROCESSED: Request has already been processed');
    }

    // Get current pending step for this approver
    const [currentStep] = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.requestId, requestId),
          eq(tables.requestSteps.stepOrder, request.currentStepOrder),
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'pending')
        )
      );

    // Also check if delegated
    if (!currentStep) {
      // Check if user is a delegate
      const [delegatedStep] = await db
        .select()
        .from(tables.requestSteps)
        .where(
          and(
            eq(tables.requestSteps.requestId, requestId),
            eq(tables.requestSteps.stepOrder, request.currentStepOrder),
            eq(tables.requestSteps.status, 'pending')
          )
        );

      if (delegatedStep) {
        // Check if approverId is a valid delegate
        const isDelegate = await checkDelegation(delegatedStep.assignedTo, approverId, request.documentType);
        if (!isDelegate) {
          throw new Error('NOT_AUTHORIZED: You are not authorized to approve this request');
        }
        // Update with delegation info
        await db
          .update(tables.requestSteps)
          .set({
            delegatedFrom: delegatedStep.assignedTo,
            assignedTo: approverId,
            status: 'approved' as ApprovalRequestStepStatus,
            actionDate: getNow(),
            comments: comments || null,
          })
          .where(eq(tables.requestSteps.id, delegatedStep.id));
      } else {
        throw new Error('NOT_AUTHORIZED: You are not authorized to approve this request');
      }
    } else {
      // Mark current step as approved
      await db
        .update(tables.requestSteps)
        .set({
          status: 'approved' as ApprovalRequestStepStatus,
          actionDate: getNow(),
          comments: comments || null,
        })
        .where(eq(tables.requestSteps.id, currentStep.id));
    }

    // Check if there are more steps
    const nextStepOrder = request.currentStepOrder + 1;
    const [nextStep] = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.requestId, requestId),
          eq(tables.requestSteps.stepOrder, nextStepOrder)
        )
      );

    if (nextStep) {
      // Move to next step
      await db
        .update(tables.requests)
        .set({
          currentStepOrder: nextStepOrder,
        })
        .where(eq(tables.requests.id, requestId));
      return { isFullyApproved: false };
    } else {
      // All steps complete - mark request as approved
      await db
        .update(tables.requests)
        .set({
          status: 'approved' as ApprovalRequestStatus,
          completedAt: getNow(),
        })
        .where(eq(tables.requests.id, requestId));
      return { isFullyApproved: true };
    }
  });
}

/**
 * Reject a request
 */
export async function rejectRequest(
  requestId: number,
  approverId: number,
  comments: string
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get request
    const [request] = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId));

    if (!request) {
      throw new Error('INVALID_REQUEST: Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('ALREADY_PROCESSED: Request has already been processed');
    }

    // Get current pending step for this approver
    const [currentStep] = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.requestId, requestId),
          eq(tables.requestSteps.stepOrder, request.currentStepOrder),
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'pending')
        )
      );

    if (!currentStep) {
      throw new Error('NOT_AUTHORIZED: You are not authorized to reject this request');
    }

    // Mark current step as rejected
    await db
      .update(tables.requestSteps)
      .set({
        status: 'rejected' as ApprovalRequestStepStatus,
        actionDate: getNow(),
        comments,
      })
      .where(eq(tables.requestSteps.id, currentStep.id));

    // Mark request as rejected
    await db
      .update(tables.requests)
      .set({
        status: 'rejected' as ApprovalRequestStatus,
        completedAt: getNow(),
      })
      .where(eq(tables.requests.id, requestId));
  });
}

/**
 * Delegate approval to another user
 */
export async function delegateApproval(
  requestId: number,
  approverId: number,
  delegateTo: number,
  comments?: string
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get request
    const [request] = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId));

    if (!request) {
      throw new Error('INVALID_REQUEST: Approval request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('ALREADY_PROCESSED: Request has already been processed');
    }

    // Get current pending step for this approver
    const [currentStep] = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.requestId, requestId),
          eq(tables.requestSteps.stepOrder, request.currentStepOrder),
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'pending')
        )
      );

    if (!currentStep) {
      throw new Error('NOT_AUTHORIZED: You are not authorized to delegate this request');
    }

    // Check if step allows delegation
    const [step] = await db
      .select()
      .from(tables.steps)
      .where(eq(tables.steps.id, currentStep.stepId));

    if (!step?.canDelegate) {
      throw new Error('NOT_AUTHORIZED: This step does not allow delegation');
    }

    // Update step to delegated status and reassign
    await db
      .update(tables.requestSteps)
      .set({
        delegatedFrom: approverId,
        assignedTo: delegateTo,
        status: 'pending' as ApprovalRequestStepStatus,
        comments: comments || null,
      })
      .where(eq(tables.requestSteps.id, currentStep.id));
  });
}

/**
 * Check if a user has delegation authority
 */
async function checkDelegation(
  originalApproverId: number,
  potentialDelegateId: number,
  documentType: string
): Promise<boolean> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const today = toQueryDate(getTodayStr());

    const [delegation] = await db
      .select()
      .from(tables.delegations)
      .where(
        and(
          eq(tables.delegations.delegatorId, originalApproverId),
          eq(tables.delegations.delegateId, potentialDelegateId),
          eq(tables.delegations.isActive, true),
          lte(tables.delegations.startDate, today),
          gte(tables.delegations.endDate, today),
          or(
            isNull(tables.delegations.documentType),
            eq(tables.delegations.documentType, documentType)
          )
        )
      );

    return !!delegation;
  });
}

// ============================================
// Approval Request Queries
// ============================================

/**
 * Get approval request by ID with details
 */
export async function getApprovalRequestById(
  id: number
): Promise<ApprovalRequestWithDetails | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [request] = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, id));

    if (!request) return null;

    const [flow] = await db
      .select()
      .from(tables.flows)
      .where(eq(tables.flows.id, request.flowId));

    const steps = await db
      .select()
      .from(tables.requestSteps)
      .where(eq(tables.requestSteps.requestId, id))
      .orderBy(asc(tables.requestSteps.stepOrder));

    // Enhance steps with assignee names
    const enhancedSteps: ApprovalRequestStepDetail[] = [];
    for (const step of steps) {
      const [assignee] = await db
        .select({ name: tables.employees.nameTh })
        .from(tables.employees)
        .where(eq(tables.employees.id, step.assignedTo));

      let delegatedFromName: string | undefined;
      if (step.delegatedFrom) {
        const [delegator] = await db
          .select({ name: tables.employees.nameTh })
          .from(tables.employees)
          .where(eq(tables.employees.id, step.delegatedFrom));
        delegatedFromName = delegator?.name;
      }

      enhancedSteps.push({
        ...step,
        assignedToName: assignee?.name,
        delegatedFromName,
      } as ApprovalRequestStepDetail);
    }

    return {
      ...request,
      flow: {
        id: flow?.id ?? 0,
        name: flow?.name ?? 'Unknown',
      },
      steps: enhancedSteps,
    } as ApprovalRequestWithDetails;
  });
}

/**
 * Get pending approval requests for an approver
 */
export async function getPendingRequestsForApprover(
  approverId: number
): Promise<ApprovalRequestWithDetails[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get pending request steps assigned to this approver
    const pendingSteps = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'pending')
        )
      );

    const requests: ApprovalRequestWithDetails[] = [];

    for (const step of pendingSteps) {
      const request = await getApprovalRequestById(step.requestId);
      if (request && request.status === 'pending' && request.currentStepOrder === step.stepOrder) {
        requests.push(request);
      }
    }

    return requests;
  });
}

/**
 * List approval requests with filtering
 */
export async function listApprovalRequests(options: {
  documentType?: DocumentType;
  status?: ApprovalRequestStatus;
  requestedBy?: number;
  assignedTo?: number;
  page?: number;
  limit?: number;
}): Promise<{ data: ApprovalRequestWithDetails[]; total: number }> {
  const { documentType, status, requestedBy, assignedTo, page = 1, limit = 20 } = options;

  return executeDbOperation(async (db) => {
    const tables = getTables();
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [];
    if (documentType) conditions.push(eq(tables.requests.documentType, documentType));
    if (status) conditions.push(eq(tables.requests.status, status));
    if (requestedBy) conditions.push(eq(tables.requests.requestedBy, requestedBy));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const requestsQuery = db
      .select()
      .from(tables.requests)
      .where(whereClause)
      .orderBy(desc(tables.requests.createdAt))
      .limit(limit)
      .offset(offset);

    let requests = await requestsQuery;

    // If filtering by assignedTo, post-filter
    if (assignedTo) {
      const filteredRequests = [];
      for (const req of requests) {
        const [currentStep] = await db
          .select()
          .from(tables.requestSteps)
          .where(
            and(
              eq(tables.requestSteps.requestId, req.id),
              eq(tables.requestSteps.stepOrder, req.currentStepOrder),
              eq(tables.requestSteps.assignedTo, assignedTo)
            )
          );
        if (currentStep) {
          filteredRequests.push(req);
        }
      }
      requests = filteredRequests;
    }

    // Get full details for each request
    const fullRequests: ApprovalRequestWithDetails[] = [];
    for (const req of requests) {
      const full = await getApprovalRequestById(req.id);
      if (full) fullRequests.push(full);
    }

    // Get total count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requests)
      .where(whereClause);

    return {
      data: fullRequests,
      total: Number(countResult?.count || 0),
    };
  });
}

// ============================================
// Approval Delegations CRUD
// ============================================

/**
 * Create approval delegation
 */
export async function createApprovalDelegation(data: {
  delegatorId: number;
  delegateId: number;
  documentType?: DocumentType;
  startDate: string;
  endDate: string;
  reason?: string;
  createdBy: number;
}): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const result = await db.insert(tables.delegations).values({
      delegatorId: data.delegatorId,
      delegateId: data.delegateId,
      documentType: data.documentType || null,
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: true,
      reason: data.reason || null,
      createdBy: data.createdBy,
      createdAt: getNow(),
    });
    return getInsertId(result);
  });
}

/**
 * List delegations
 */
export async function listApprovalDelegations(options: {
  delegatorId?: number;
  delegateId?: number;
  isActive?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ data: unknown[]; total: number }> {
  const { delegatorId, delegateId, isActive, page = 1, limit = 20 } = options;

  return executeDbOperation(async (db) => {
    const tables = getTables();
    const offset = (page - 1) * limit;

    const conditions = [];
    if (delegatorId) conditions.push(eq(tables.delegations.delegatorId, delegatorId));
    if (delegateId) conditions.push(eq(tables.delegations.delegateId, delegateId));
    if (isActive !== undefined) conditions.push(eq(tables.delegations.isActive, isActive));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const delegations = await db
      .select()
      .from(tables.delegations)
      .where(whereClause)
      .orderBy(desc(tables.delegations.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.delegations)
      .where(whereClause);

    return {
      data: delegations,
      total: Number(countResult?.count || 0),
    };
  });
}

/**
 * Deactivate a delegation
 */
export async function deactivateDelegation(id: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    await db
      .update(tables.delegations)
      .set({ isActive: false })
      .where(eq(tables.delegations.id, id));
  });
}

// ============================================
// Dashboard
// ============================================

/**
 * Get approval dashboard data for an approver
 */
export async function getApprovalDashboard(
  approverId: number
): Promise<ApprovalDashboard> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const today = toQueryDate(getTodayStr());

    // Get pending requests for this approver
    const pendingRequests = await getPendingRequestsForApprover(approverId);

    // Get approved count today
    const approvedToday = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'approved'),
          gte(tables.requestSteps.actionDate, today)
        )
      );

    // Get rejected count today
    const rejectedToday = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.assignedTo, approverId),
          eq(tables.requestSteps.status, 'rejected'),
          gte(tables.requestSteps.actionDate, today)
        )
      );

    // Get recent actions
    const recentSteps = await db
      .select()
      .from(tables.requestSteps)
      .where(
        and(
          eq(tables.requestSteps.assignedTo, approverId),
          or(
            eq(tables.requestSteps.status, 'approved'),
            eq(tables.requestSteps.status, 'rejected')
          )
        )
      )
      .orderBy(desc(tables.requestSteps.actionDate))
      .limit(10);

    const recentActions: RecentApprovalAction[] = [];
    for (const step of recentSteps) {
      const [request] = await db
        .select()
        .from(tables.requests)
        .where(eq(tables.requests.id, step.requestId));

      if (request) {
        recentActions.push({
          id: step.id,
          documentType: request.documentType as DocumentType,
          documentNumber: `${request.documentType.toUpperCase()}-${request.documentId}`,
          action: step.status === 'approved' ? 'approve' : 'reject',
          actionBy: String(step.assignedTo),
          actionDate: step.actionDate || '',
          comments: step.comments,
        });
      }
    }

    return {
      pendingCount: pendingRequests.length,
      approvedTodayCount: approvedToday.length,
      rejectedTodayCount: rejectedToday.length,
      pendingRequests,
      recentActions,
    };
  });
}

/**
 * Cancel an approval request
 */
export async function cancelApprovalRequest(
  requestId: number,
  cancelledBy: number
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get request
    const [request] = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.id, requestId));

    if (!request) {
      throw new Error('INVALID_REQUEST: Approval request not found');
    }

    // Only requester can cancel
    if (request.requestedBy !== cancelledBy) {
      throw new Error('NOT_AUTHORIZED: Only the requester can cancel this request');
    }

    if (request.status !== 'pending') {
      throw new Error('ALREADY_PROCESSED: Request has already been processed');
    }

    // Mark request as cancelled
    await db
      .update(tables.requests)
      .set({
        status: 'cancelled' as ApprovalRequestStatus,
        completedAt: getNow(),
      })
      .where(eq(tables.requests.id, requestId));
  });
}

/**
 * Get approval request status for a document
 */
export async function getDocumentApprovalStatus(
  documentType: DocumentType,
  documentId: number
): Promise<ApprovalRequestWithDetails | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [request] = await db
      .select()
      .from(tables.requests)
      .where(
        and(
          eq(tables.requests.documentType, documentType),
          eq(tables.requests.documentId, documentId)
        )
      )
      .orderBy(desc(tables.requests.createdAt))
      .limit(1);

    if (!request) return null;

    return getApprovalRequestById(request.id);
  });
}

// ============================================
// Workflow Testing/Preview (T124)
// ============================================

export interface TestWorkflowInput {
  flowId: number;
  testContext: DocumentContext;
}

export interface TestWorkflowResult {
  matches: boolean;
  matchedRules: {
    field: string;
    operator: string;
    expectedValue: string;
    actualValue: string;
    passed: boolean;
  }[];
  steps: {
    stepOrder: number;
    approverType: string;
    approverId?: number;
    approverName?: string;
    canApprove: boolean;
  }[];
  errors: string[];
}

/**
 * Test/Preview a workflow with sample document context (T124)
 * Useful for validating workflow configuration before going live
 */
export async function testWorkflow(
  input: TestWorkflowInput
): Promise<TestWorkflowResult> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const errors: string[] = [];
    const matchedRules: TestWorkflowResult['matchedRules'] = [];
    const steps: TestWorkflowResult['steps'] = [];

    // Get the workflow
    const flow = await getApprovalFlowById(input.flowId);
    if (!flow) {
      return {
        matches: false,
        matchedRules: [],
        steps: [],
        errors: ['Workflow not found'],
      };
    }

    // Validate document type matches
    if (flow.documentType !== input.testContext.documentType) {
      errors.push(
        `Document type mismatch: workflow is for ${flow.documentType}, ` +
          `but test context is ${input.testContext.documentType}`
      );
    }

    // Evaluate each rule
    let allRulesPass = true;
    for (const rule of flow.rules) {
      const actualValue = getContextValue(input.testContext, rule.fieldName);
      const passed = evaluateRuleValue(rule.operator as RuleOperator, actualValue, rule.value, rule.valueTo);

      matchedRules.push({
        field: rule.fieldName,
        operator: rule.operator,
        expectedValue: rule.valueTo
          ? `${rule.value} to ${rule.valueTo}`
          : rule.value,
        actualValue: String(actualValue ?? 'undefined'),
        passed,
      });

      if (!passed) {
        allRulesPass = false;
      }
    }

    // If all rules pass (or no rules), evaluate steps
    const matches = allRulesPass && errors.length === 0;

    if (matches) {
      for (const step of flow.steps) {
        let approverName: string | undefined;
        let canApprove = false;

        if (step.approverType === 'user' && step.approverId) {
          const [user] = await db
            .select()
            .from(tables.users)
            .where(eq(tables.users.id, step.approverId))
            .limit(1);
          if (user) {
            approverName = (user as { displayName?: string }).displayName || `User ${step.approverId}`;
            canApprove = true;
          } else {
            errors.push(`Step ${step.stepOrder}: Approver user ${step.approverId} not found`);
          }
        } else if (step.approverType === 'role' && step.approverId) {
          approverName = `Role ID: ${step.approverId}`;
          canApprove = true; // Assume role exists
        } else if (step.approverType === 'requester_manager') {
          approverName = 'Requestor Manager';
          canApprove = true;
        } else if (step.approverType === 'department_head') {
          approverName = 'Department Head';
          canApprove = true;
        }

        steps.push({
          stepOrder: step.stepOrder,
          approverType: step.approverType,
          approverId: step.approverId ?? undefined,
          approverName,
          canApprove,
        });
      }
    }

    return {
      matches,
      matchedRules,
      steps,
      errors,
    };
  });
}

/**
 * Get value from document context by field name
 */
function getContextValue(context: DocumentContext, field: string): unknown {
  switch (field) {
    case 'amount':
      return context.amount;
    case 'department':
      return context.departmentId;
    case 'costCenter':
      return context.costCenterId;
    case 'project':
      return context.projectId;
    case 'vendor':
      return context.vendorId;
    case 'customer':
      return context.customerId;
    case 'category':
      return context.categoryId;
    default:
      return undefined;
  }
}

/**
 * Evaluate a rule condition with raw values (for testWorkflow)
 */
function evaluateRuleValue(
  operator: RuleOperator,
  actualValue: unknown,
  expectedValue: string,
  secondaryValue?: string | null
): boolean {
  // Handle null/undefined actual values
  if (actualValue === null || actualValue === undefined) {
    return operator === 'ne' || operator === 'not_in';
  }

  const actual = typeof actualValue === 'number' ? actualValue : String(actualValue);
  const expected = typeof actualValue === 'number' ? parseFloat(expectedValue) : expectedValue;

  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && actual > (expected as number);
    case 'gte':
      return typeof actual === 'number' && actual >= (expected as number);
    case 'lt':
      return typeof actual === 'number' && actual < (expected as number);
    case 'lte':
      return typeof actual === 'number' && actual <= (expected as number);
    case 'between':
      if (typeof actual !== 'number' || !secondaryValue) return false;
      const min = parseFloat(expectedValue);
      const max = parseFloat(secondaryValue);
      return actual >= min && actual <= max;
    case 'in':
      const inList = expectedValue.split(',').map((v) => v.trim());
      return inList.includes(String(actual));
    case 'not_in':
      const notInList = expectedValue.split(',').map((v) => v.trim());
      return !notInList.includes(String(actual));
    default:
      return false;
  }
}

/**
 * Get workflow history/audit log for a specific flow
 */
export async function getWorkflowHistory(
  flowId: number,
  options?: { page?: number; limit?: number }
): Promise<{
  data: {
    id: number;
    documentType: string;
    documentId: number;
    status: string;
    requestedAt: string;
    completedAt: string | null;
    requestedByName: string;
    steps: {
      stepOrder: number;
      status: string;
      approverName: string | null;
      actionAt: string | null;
      comments: string | null;
    }[];
  }[];
  total: number;
  page: number;
  limit: number;
}> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;

    // Get requests for this flow
    const requests = await db
      .select()
      .from(tables.requests)
      .where(eq(tables.requests.flowId, flowId))
      .orderBy(desc(tables.requests.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total
    const [countResult] = await db
      .select({ count: tables.requests.id })
      .from(tables.requests)
      .where(eq(tables.requests.flowId, flowId));

    const total = Number((countResult as { count: number })?.count || 0);

    // Get detailed info for each request
    const data = await Promise.all(
      requests.map(async (request: any) => {
        const [requester] = await db
          .select()
          .from(tables.users)
          .where(eq(tables.users.id, request.requestedBy))
          .limit(1);

        const requestSteps = await db
          .select()
          .from(tables.requestSteps)
          .where(eq(tables.requestSteps.requestId, request.id))
          .orderBy(asc(tables.requestSteps.stepOrder));

        const stepsWithNames = await Promise.all(
          requestSteps.map(async (step: any) => {
            let approverName = null;
            if (step.actionBy) {
              const [actor] = await db
                .select()
                .from(tables.users)
                .where(eq(tables.users.id, step.actionBy))
                .limit(1);
              approverName = (actor as { displayName?: string })?.displayName || `User ${step.actionBy}`;
            }
            return {
              stepOrder: step.stepOrder,
              status: step.status,
              approverName,
              actionAt: step.actionAt?.toString() || null,
              comments: step.comments,
            };
          })
        );

        return {
          id: request.id,
          documentType: request.documentType,
          documentId: request.documentId,
          status: request.status,
          requestedAt: request.createdAt.toString(),
          completedAt: request.completedAt?.toString() || null,
          requestedByName: (requester as { displayName?: string })?.displayName || `User ${request.requestedBy}`,
          steps: stepsWithNames,
        };
      })
    );

    return { data, total, page, limit };
  });
}
