/**
 * Purchase Requisition Service (T033-T036)
 * Part of 011-accounting-spec-gap
 */

import { eq, and, or, like, gte, lte, desc, asc, sql, isNull, inArray } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import { submitForApproval, approveRequest, rejectRequest } from './approval-workflow.service';
import { notifyMetaherbPrStatus, isMetaherbOrigin } from './metaherb-pr-webhook.service';
import type {
  PurchaseRequisition,
  PurchaseRequisitionLine,
  PRWithLines,
  PRCreateInput,
  PRUpdateInput,
  PRLineInput,
  PRStatus,
  PRListFilter,
  PRListResponse,
  PRSubmitResponse,
  PRToPOConvertInput,
  PRToPOConvertResponse,
  PRDashboardSummary,
  PRApprovalInput,
  PRTimelineEntry,
} from '@/types/purchase-requisition';

/**
 * Get table references
 */
function getTables() {
  return {
    requisitions: getTableRef('purchaseRequisitions'),
    lines: getTableRef('purchaseRequisitionLines'),
    employees: getTableRef('HREmployees'),
    departments: getTableRef('HROrgUnits'),
    vendors: getTableRef('vendors'),
    purchaseOrders: getTableRef('purchaseOrders'),
    purchaseOrderLines: getTableRef('purchaseOrderLines'),
    users: getTableRef('users'),
    approvalRequests: getTableRef('approvalRequests'),
    approvalRequestSteps: getTableRef('approvalRequestSteps'),
  };
}

/**
 * Resolve an HR employee's display name (English first, Thai fallback).
 * Returns '' when the id is null or the employee is not found.
 */
async function resolveEmployeeName(db: any, employeeId: number | null | undefined): Promise<string> {
  if (!employeeId) return '';
  const tables = getTables();
  const rows = await db
    .select({
      firstNameEn: tables.employees.firstNameEn,
      lastNameEn: tables.employees.lastNameEn,
      firstName: tables.employees.firstName,
      lastName: tables.employees.lastName,
    })
    .from(tables.employees)
    .where(eq(tables.employees.id, employeeId))
    .limit(1);
  if (rows.length === 0) return '';
  const emp = rows[0];
  return emp.firstNameEn && emp.lastNameEn
    ? `${emp.firstNameEn} ${emp.lastNameEn}`
    : `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
}

/**
 * Resolve the HR employee id linked to a user account (hr_employees.userId).
 * Used to derive the PR requester from the logged-in user instead of a
 * hard-coded id. Returns null when the user has no linked employee record.
 */
export async function getEmployeeIdForUser(userId: number): Promise<number | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const rows = await db
      .select({ id: tables.employees.id })
      .from(tables.employees)
      .where(eq(tables.employees.userId, userId))
      .limit(1);
    return rows.length > 0 ? rows[0].id : null;
  });
}

/**
 * Generate next PR number
 */
export async function generatePRNumber(): Promise<string> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const year = new Date().getFullYear();
    const prefix = `PR${year}-`;

    // Get the latest PR number for the current year
    const result = await db
      .select({ prNumber: tables.requisitions.prNumber })
      .from(tables.requisitions)
      .where(like(tables.requisitions.prNumber, `${prefix}%`))
      .orderBy(desc(tables.requisitions.id))
      .limit(1);

    if (result.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = result[0].prNumber;
    const sequence = parseInt(lastNumber.replace(prefix, ''), 10);
    const nextSequence = (sequence + 1).toString().padStart(4, '0');
    return `${prefix}${nextSequence}`;
  });
}

/**
 * Create a new Purchase Requisition
 * PR number generation and insert are wrapped in a transaction to prevent duplicates.
 */
export async function createPR(
  data: PRCreateInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = getNow();

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const year = new Date().getFullYear();
        const prefix = `PR${year}-`;

        const existing = await db
          .select({ prNumber: tables.requisitions.prNumber })
          .from(tables.requisitions)
          .where(like(tables.requisitions.prNumber, `${prefix}%`))
          .orderBy(desc(tables.requisitions.id))
          .limit(1);

        let prNumber: string;
        if (existing.length === 0) {
          prNumber = `${prefix}0001`;
        } else {
          const lastNumber = existing[0].prNumber;
          const sequence = parseInt(lastNumber.replace(prefix, ''), 10);
          prNumber = `${prefix}${(sequence + 1).toString().padStart(4, '0')}`;
        }

        const insertResult = await db.insert(tables.requisitions).values({
          prNumber,
          requesterId: data.requesterId,
          departmentId: data.departmentId || null,
          status: 'draft',
          priority: data.priority || 'normal',
          requiredDate: data.requiredDate ? toDbDate(data.requiredDate) : null,
          description: data.description || null,
          justification: data.justification || null,
          costCenterId: data.costCenterId || null,
          projectId: data.projectId || null,
          externalSource: data.externalSource || null,
          externalRef: data.externalRef || null,
          totalAmount: 0,
          createdBy,
          createdAt: now,
          updatedAt: now,
        });

        return getInsertId(insertResult);
      } catch (error: any) {
        if (attempt < MAX_RETRIES - 1 && (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed'))) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate unique PR number after maximum retries');
  });
}

/**
 * Get PR by ID
 */
export async function getPRById(id: number): Promise<PRWithLines | null> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const prResults = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, id))
      .limit(1);

    if (prResults.length === 0) {
      return null;
    }

    const pr = prResults[0];

    // Get lines
    const lines = await db
      .select()
      .from(tables.lines)
      .where(eq(tables.lines.prId, id))
      .orderBy(asc(tables.lines.lineNumber));

    // Get requester name
    let requesterName = '';
    if (pr.requesterId) {
      const empResult = await db
        .select({
          firstNameEn: tables.employees.firstNameEn,
          lastNameEn: tables.employees.lastNameEn,
          firstName: tables.employees.firstName,
          lastName: tables.employees.lastName,
        })
        .from(tables.employees)
        .where(eq(tables.employees.id, pr.requesterId))
        .limit(1);
      if (empResult.length > 0) {
        const emp = empResult[0];
        // Prefer English name, fallback to Thai name
        requesterName = emp.firstNameEn && emp.lastNameEn
          ? `${emp.firstNameEn} ${emp.lastNameEn}`
          : `${emp.firstName} ${emp.lastName}`;
      }
    }

    // Get department name
    let departmentName = '';
    if (pr.departmentId) {
      const deptResult = await db
        .select({ name: tables.departments.name })
        .from(tables.departments)
        .where(eq(tables.departments.id, pr.departmentId))
        .limit(1);
      if (deptResult.length > 0) {
        departmentName = deptResult[0].name || '';
      }
    }

    // Get the name of the user who recorded the PR (createdBy → users, distinct
    // from requesterId → HR employee). Lets the detail page show "บันทึกโดย".
    let createdByName = '';
    if (pr.createdBy) {
      const userResult = await db
        .select({ name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, pr.createdBy))
        .limit(1);
      if (userResult.length > 0) {
        createdByName = userResult[0].name || '';
      }
    }

    // Resolve the approver's name when the PR has been approved. approvedBy may
    // be null on older PRs (it wasn't stamped before) — in that case the
    // approval history below is the source of truth.
    const approvedByName = await resolveEmployeeName(db, pr.approvedBy as number | null);

    // Lookup item codes for lines that have itemId
    const itemIds = lines
      .map((l: any) => l.itemId)
      .filter((id: unknown): id is number => id != null);
    const itemCodeMap: Record<number, string> = {};
    if (itemIds.length > 0) {
      const itemsTable = getTableRef('items');
      const itemsResult = await db
        .select({ id: itemsTable.id, code: itemsTable.code })
        .from(itemsTable)
        .where(inArray(itemsTable.id, itemIds));
      for (const item of itemsResult) {
        itemCodeMap[item.id] = item.code;
      }
    }

    return {
      ...pr,
      requesterName,
      departmentName,
      createdByName,
      approvedByName,
      lines: lines.map((line: {
        id?: number;
        prId?: number;
        lineNumber?: number;
        itemId?: number | null;
        description?: string;
        quantity?: number | null;
        unit?: string | null;
        estimatedPrice?: number | null;
        lineTotal?: number | null;
        preferredVendorId?: number | null;
        notes?: string | null;
        status?: string;
        createdAt?: unknown;
        [key: string]: unknown
      }) => ({
        id: line.id,
        prId: line.prId,
        lineNumber: line.lineNumber,
        itemId: line.itemId,
        itemCode: line.itemId ? (itemCodeMap[line.itemId] || null) : null,
        description: line.description || '',
        quantity: Number(line.quantity) || 0,
        unitOfMeasure: line.unit || '', // Map unit -> unitOfMeasure
        estimatedUnitPrice: Number(line.estimatedPrice) || 0, // Map estimatedPrice -> estimatedUnitPrice
        estimatedAmount: (Number(line.quantity) || 0) * (Number(line.estimatedPrice) || 0),
        suggestedVendorId: line.preferredVendorId, // Map preferredVendorId -> suggestedVendorId
        notes: line.notes,
        status: line.status || 'pending',
        createdAt: line.createdAt,
      })),
    } as PRWithLines;
  });
}

/**
 * Build the action timeline for a PR: who created it, then every approval
 * step (assignee/approver, action date, comments). The creation entry is
 * synthesised from the PR row; the approval steps are read from
 * approval_request_steps via the approval_requests row that links to this PR
 * (documentType='purchase_requisition', documentId=prId).
 *
 * Returns [] when the PR doesn't exist. A PR that was never submitted still
 * returns the single "created" entry.
 */
export async function getPRApprovalHistory(prId: number): Promise<PRTimelineEntry[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const [pr] = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (!pr) return [];

    const timeline: PRTimelineEntry[] = [];

    // 1) Creation entry — createdBy is a user account.
    let createdByName = '';
    if (pr.createdBy) {
      const [u] = await db
        .select({ name: tables.users.name })
        .from(tables.users)
        .where(eq(tables.users.id, pr.createdBy))
        .limit(1);
      createdByName = u?.name || '';
    }
    timeline.push({
      type: 'created',
      stepOrder: 0,
      stepName: 'created',
      actorName: createdByName,
      actionDate: pr.createdAt ?? null,
      comments: null,
    });

    // 2) Approval-workflow steps — find the approval request for this PR.
    const [request] = await db
      .select()
      .from(tables.approvalRequests)
      .where(
        and(
          eq(tables.approvalRequests.documentType, 'purchase_requisition'),
          eq(tables.approvalRequests.documentId, prId),
        ),
      )
      .orderBy(desc(tables.approvalRequests.id))
      .limit(1);

    if (request) {
      const steps = await db
        .select()
        .from(tables.approvalRequestSteps)
        .where(eq(tables.approvalRequestSteps.requestId, request.id))
        .orderBy(asc(tables.approvalRequestSteps.stepOrder));

      for (const step of steps) {
        const actorName = await resolveEmployeeName(db, step.assignedTo);
        const delegatedFromName = step.delegatedFrom
          ? await resolveEmployeeName(db, step.delegatedFrom)
          : undefined;

        // Map the step status onto a timeline entry type. 'pending' steps are
        // included so the user can see who the PR is waiting on.
        const status = String(step.status || 'pending');
        const type: PRTimelineEntry['type'] =
          status === 'approved'
            ? 'approved'
            : status === 'rejected'
              ? 'rejected'
              : 'pending';

        timeline.push({
          type,
          stepOrder: step.stepOrder ?? null,
          stepName: status === 'pending' ? 'pending_approval' : status,
          actorName,
          delegatedFromName,
          actionDate: step.actionDate ?? null,
          comments: step.comments ?? null,
        });
      }
    }

    return timeline;
  });
}

/**
 * List Purchase Requisitions with filtering
 */
export async function listPRs(filter: PRListFilter): Promise<PRListResponse> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: any[] = [];

    if (filter.status) {
      conditions.push(eq(tables.requisitions.status, filter.status));
    }
    if (filter.priority) {
      conditions.push(eq(tables.requisitions.priority, filter.priority));
    }
    if (filter.requesterId) {
      conditions.push(eq(tables.requisitions.requesterId, filter.requesterId));
    }
    if (filter.departmentId) {
      conditions.push(eq(tables.requisitions.departmentId, filter.departmentId));
    }
    if (filter.fromDate) {
      conditions.push(gte(tables.requisitions.createdAt, toDbDate(filter.fromDate)));
    }
    if (filter.toDate) {
      conditions.push(lte(tables.requisitions.createdAt, toDbDate(filter.toDate)));
    }
    if (filter.search) {
      conditions.push(
        or(
          like(tables.requisitions.prNumber, `%${filter.search}%`),
          like(tables.requisitions.description, `%${filter.search}%`)
        )
      );
    }

    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);

    // Get data with pagination
    const data = await db
      .select()
      .from(tables.requisitions)
      .where(whereClause)
      .orderBy(desc(tables.requisitions.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: data as PurchaseRequisition[],
      total,
      page,
      limit,
    };
  });
}

/**
 * Update a Purchase Requisition
 */
export async function updatePR(
  id: number,
  data: PRUpdateInput
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check if PR exists and is in draft status
    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, id))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    if (prResult[0].status !== 'draft') {
      throw new Error('PR_NOT_EDITABLE');
    }

    await db
      .update(tables.requisitions)
      .set({
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.requiredDate !== undefined && {
          requiredDate: data.requiredDate ? toDbDate(data.requiredDate) : null,
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.justification !== undefined && { justification: data.justification }),
        ...(data.costCenterId !== undefined && { costCenterId: data.costCenterId }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        updatedAt: getNow(),
      })
      .where(eq(tables.requisitions.id, id));
  });
}

/**
 * Add lines to a Purchase Requisition
 */
export async function addPRLines(
  prId: number,
  lines: PRLineInput[]
): Promise<number[]> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check if PR exists and is editable
    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    if (prResult[0].status !== 'draft') {
      throw new Error('PR_NOT_EDITABLE');
    }

    // Get current max line number
    const maxLineResult = await db
      .select({ maxLine: sql<number>`COALESCE(MAX(line_number), 0)` })
      .from(tables.lines)
      .where(eq(tables.lines.prId, prId));

    let lineNumber = Number(maxLineResult[0]?.maxLine || 0);
    const now = getNow();
    const insertedIds: number[] = [];
    let totalAmount = 0;

    for (const line of lines) {
      lineNumber++;
      const lineTotal = (line.quantity || 0) * (line.estimatedUnitPrice || 0);
      totalAmount += lineTotal;

      const result = await db.insert(tables.lines).values({
        prId,
        lineNumber,
        itemId: line.itemId || null,
        description: line.description,
        quantity: line.quantity,
        unit: line.unitOfMeasure, // Map from validation schema field to DB column
        estimatedPrice: line.estimatedUnitPrice || 0,
        lineTotal,
        preferredVendorId: line.suggestedVendorId || null,
        notes: line.notes || null,
        status: 'pending',
        createdAt: now,
      });

      insertedIds.push(getInsertId(result));
    }

    // Update total estimated amount
    await recalculatePRTotal(prId);

    return insertedIds;
  });
}

/**
 * Update a PR line
 */
export async function updatePRLine(
  prId: number,
  lineId: number,
  data: Partial<PRLineInput>
): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check if PR is editable
    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    if (prResult[0].status !== 'draft') {
      throw new Error('PR_NOT_EDITABLE');
    }

    // Get current line data
    const lineResult = await db
      .select()
      .from(tables.lines)
      .where(and(eq(tables.lines.id, lineId), eq(tables.lines.prId, prId)))
      .limit(1);

    if (lineResult.length === 0) {
      throw new Error('LINE_NOT_FOUND');
    }

    const currentLine = lineResult[0];
    const newQuantity = Number(data.quantity ?? currentLine.quantity) || 0;
    const newUnitPrice = Number(data.estimatedUnitPrice ?? currentLine.estimatedPrice) || 0;
    const lineTotal = newQuantity * newUnitPrice;

    await db
      .update(tables.lines)
      .set({
        ...(data.itemId !== undefined && { itemId: data.itemId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unitOfMeasure !== undefined && { unit: data.unitOfMeasure }),
        ...(data.estimatedUnitPrice !== undefined && { estimatedPrice: data.estimatedUnitPrice }),
        lineTotal,
        ...(data.suggestedVendorId !== undefined && { preferredVendorId: data.suggestedVendorId }),
        ...(data.notes !== undefined && { notes: data.notes }),
      })
      .where(eq(tables.lines.id, lineId));

    // Recalculate total
    await recalculatePRTotal(prId);
  });
}

/**
 * Delete a PR line
 */
export async function deletePRLine(prId: number, lineId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Check if PR is editable
    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    if (prResult[0].status !== 'draft') {
      throw new Error('PR_NOT_EDITABLE');
    }

    await db
      .delete(tables.lines)
      .where(and(eq(tables.lines.id, lineId), eq(tables.lines.prId, prId)));

    // Recalculate total
    await recalculatePRTotal(prId);
  });
}

/**
 * Delete an entire PR and its lines (draft only)
 */
export async function deletePR(prId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    if (prResult[0].status !== 'draft') {
      throw new Error('PR_NOT_DELETABLE');
    }

    // Delete lines first (foreign key)
    await db.delete(tables.lines).where(eq(tables.lines.prId, prId));

    // Delete PR header
    await db.delete(tables.requisitions).where(eq(tables.requisitions.id, prId));
  });
}

/**
 * Recalculate PR total from lines
 */
async function recalculatePRTotal(prId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const sumResult = await db
      .select({ total: sql<number>`COALESCE(SUM(line_total), 0)` })
      .from(tables.lines)
      .where(eq(tables.lines.prId, prId));

    const total = Number(sumResult[0]?.total || 0);

    await db
      .update(tables.requisitions)
      .set({
        totalAmount: total,
        updatedAt: getNow(),
      })
      .where(eq(tables.requisitions.id, prId));
  });
}

/**
 * Submit PR for approval (T035)
 */
export async function submitPRForApproval(
  prId: number,
  submitterId: number
): Promise<PRSubmitResponse> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    // Get PR
    const prResult = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    const pr = prResult[0];

    if (pr.status !== 'draft') {
      throw new Error('PR_NOT_IN_DRAFT');
    }

    // Check if PR has lines
    const lineCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.lines)
      .where(eq(tables.lines.prId, prId));

    if (Number(lineCount[0]?.count || 0) === 0) {
      throw new Error('PR_NO_LINES');
    }

    // Submit to approval workflow
    const approvalResult = await submitForApproval({
      documentType: 'purchase_requisition',
      documentId: prId,
      requesterId: submitterId,
      totalAmount: pr.totalAmount,
      priority: pr.priority,
      departmentId: pr.departmentId,
    });

    // Update PR status
    // NOTE: submittedAt / approvalRequestId are NOT columns on
    // purchase_requisitions. The approval linkage lives in the
    // approval_requests table (looked up by documentType + documentId
    // in approvePR/rejectPR), so we only persist status here.
    const now = getNow();
    await db
      .update(tables.requisitions)
      .set({
        status: 'pending_approval',
        updatedAt: now,
      })
      .where(eq(tables.requisitions.id, prId));

    return {
      success: true,
      prId,
      prNumber: pr.prNumber,
      approvalRequestId: approvalResult.requestId,
      flowName: approvalResult.flowName,
    };
  });
}

/**
 * Approve a Purchase Requisition
 */
export async function approvePR(
  prId: number,
  approverId: number,
  comments?: string
): Promise<void> {
  const becameApproved = await executeDbOperation(async (db) => {
    const tables = getTables();

    // Get PR
    const prResult = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    const pr = prResult[0];

    if (pr.status !== 'pending_approval') {
      throw new Error('PR_NOT_PENDING_APPROVAL');
    }

    // Look up approval request from approval_requests table
    const approvalRequests = getTableRef('approvalRequests');
    const arResult = await db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.documentType, 'purchase_requisition'),
          eq(approvalRequests.documentId, prId),
          eq(approvalRequests.status, 'pending')
        )
      )
      .limit(1);

    if (arResult.length === 0) {
      throw new Error('NO_APPROVAL_REQUEST');
    }

    const approvalRequestId = arResult[0].id;

    // Approve in workflow
    const result = await approveRequest(approvalRequestId, approverId, comments);

    // Check if fully approved
    if (result.isFullyApproved) {
      const now = getNow();
      await db
        .update(tables.requisitions)
        .set({
          status: 'approved',
          approvedAt: now,
          updatedAt: now,
        })
        .where(eq(tables.requisitions.id, prId));

      // Mark all lines as approved (lines table has no updatedAt column)
      await db
        .update(tables.lines)
        .set({
          status: 'approved',
        })
        .where(eq(tables.lines.prId, prId));
    }
    return result.isFullyApproved === true;
  });

  // After commit: push the new status to Metaherb (only fires for Metaherb-
  // originated PRs; the notifier short-circuits otherwise). Fire-and-forget —
  // it never throws and the PR approval stands regardless of webhook outcome.
  if (becameApproved) {
    void notifyMetaherbPrStatus(prId, 'approved');
  }
}

/**
 * Reject a Purchase Requisition
 */
export async function rejectPR(
  prId: number,
  approverId: number,
  reason: string
): Promise<void> {
  await executeDbOperation(async (db) => {
    const tables = getTables();

    // Get PR
    const prResult = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    const pr = prResult[0];

    if (pr.status !== 'pending_approval') {
      throw new Error('PR_NOT_PENDING_APPROVAL');
    }

    // Look up approval request from approval_requests table
    const approvalRequests = getTableRef('approvalRequests');
    const arResult = await db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.documentType, 'purchase_requisition'),
          eq(approvalRequests.documentId, prId),
          eq(approvalRequests.status, 'pending')
        )
      )
      .limit(1);

    if (arResult.length === 0) {
      throw new Error('NO_APPROVAL_REQUEST');
    }

    const approvalRequestId = arResult[0].id;

    // Reject in workflow
    await rejectRequest(approvalRequestId, approverId, reason);

    // Update PR status
    // NOTE: rejectedAt is not a column on purchase_requisitions; the
    // rejection reason + status capture the rejection.
    const now = getNow();
    await db
      .update(tables.requisitions)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(tables.requisitions.id, prId));

    // Mark all lines as rejected (lines table has no updatedAt column)
    await db
      .update(tables.lines)
      .set({
        status: 'rejected',
      })
      .where(eq(tables.lines.prId, prId));
  });

  // After commit: notify Metaherb (fires only for Metaherb-originated PRs).
  void notifyMetaherbPrStatus(prId, 'rejected');
}

/**
 * Fixed profile for the Metaherb vendor. `code` is the immutable business key
 * we match on — never change it. The other fields are seed values used only on
 * first creation; staff can edit them later in the vendor page without breaking
 * the match. payment_terms is left blank pending PM's decision.
 */
const METAHERB_VENDOR = {
  code: 'METAHERB',
  name: 'บริษัท เมต้าเฮิร์บ จำกัด (METAHERB CO., LTD.)',
  taxId: '0105565148242',
  address: '459/153 ถนนสุขสวัสดิ์ แขวงราษฎร์บูรณะ เขตราษฎร์บูรณะ กรุงเทพมหานคร 10140',
  contactPerson: 'อรรถพล อุทัยเรือง',
  phone: '0614213111',
  email: 'metaherb.herb@gmail.com',
  paymentTerms: '',
} as const;

/**
 * Find-or-create the Metaherb vendor, idempotently. We match on the immutable
 * `code` (unique) first, then fall back to `tax_id` (covers a row created by
 * hand under a different code), and only create when neither matches. We never
 * match on name — names get typed many ways (METAHER / metaherb / เมตาเฮิร์บ)
 * and matching on them would spawn duplicates. A previously-deactivated vendor
 * is re-activated so it can be selected for the PO. Always returns a vendorId.
 *
 * `db` is the active transaction handle from executeDbOperation.
 */
async function ensureMetaherbVendor(db: any): Promise<number> {
  const tables = getTables();
  const now = getNow();

  // 1) match on code (unique business key)
  const byCode = await db
    .select({ id: tables.vendors.id, isActive: tables.vendors.isActive })
    .from(tables.vendors)
    .where(eq(tables.vendors.code, METAHERB_VENDOR.code))
    .limit(1);
  if (byCode.length > 0) {
    if (!byCode[0].isActive) {
      await db
        .update(tables.vendors)
        .set({ isActive: true, updatedAt: now })
        .where(eq(tables.vendors.id, byCode[0].id));
    }
    return byCode[0].id;
  }

  // 2) fallback: match on tax_id (e.g. created by hand under another code)
  if (METAHERB_VENDOR.taxId) {
    const byTax = await db
      .select({ id: tables.vendors.id })
      .from(tables.vendors)
      .where(eq(tables.vendors.taxId, METAHERB_VENDOR.taxId))
      .limit(1);
    if (byTax.length > 0) {
      return byTax[0].id;
    }
  }

  // 3) create (first purchase). Guard the unique-code race: if a concurrent
  // convert created it first, re-select by code and reuse that row.
  try {
    const res = await db.insert(tables.vendors).values({
      code: METAHERB_VENDOR.code,
      name: METAHERB_VENDOR.name,
      taxId: METAHERB_VENDOR.taxId,
      contactPerson: METAHERB_VENDOR.contactPerson,
      phone: METAHERB_VENDOR.phone,
      email: METAHERB_VENDOR.email,
      address: METAHERB_VENDOR.address,
      paymentTerms: METAHERB_VENDOR.paymentTerms || null,
      isApproved: true, // selectable as a PO vendor immediately
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return getInsertId(res);
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed')) {
      const again = await db
        .select({ id: tables.vendors.id })
        .from(tables.vendors)
        .where(eq(tables.vendors.code, METAHERB_VENDOR.code))
        .limit(1);
      if (again.length > 0) {
        return again[0].id;
      }
    }
    throw error;
  }
}

/**
 * Convert approved PR to PO (T036)
 */
export async function convertPRToPO(
  input: PRToPOConvertInput,
  createdBy: number
): Promise<PRToPOConvertResponse> {
  // Set inside the DB op when the PR reaches 'converted' (all lines converted),
  // read after commit to fire the Metaherb webhook.
  let prFullyConverted = false;
  const response = await executeDbOperation(async (db) => {
    const tables = getTables();

    // Get PR
    const prResult = await db
      .select()
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, input.prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    const pr = prResult[0];

    if (pr.status !== 'approved') {
      throw new Error('PR_NOT_APPROVED');
    }

    // For Metaherb-originated PRs the supplier is always Metaherb — find-or-create
    // that vendor and force it, ignoring whatever vendor the UI sent. Non-Metaherb
    // PRs keep the user-selected vendor (existing behaviour) and still require one.
    let vendorId = input.vendorId;
    if (isMetaherbOrigin(pr.externalSource)) {
      vendorId = await ensureMetaherbVendor(db);
    } else if (!vendorId) {
      throw new Error('VENDOR_REQUIRED');
    }

    // Get lines to convert
    let linesQuery = db
      .select()
      .from(tables.lines)
      .where(
        and(
          eq(tables.lines.prId, input.prId),
          eq(tables.lines.status, 'approved')
        )
      );

    if (input.lineIds && input.lineIds.length > 0) {
      // Filter to specific lines
      const lineConditions = input.lineIds.map((id) => eq(tables.lines.id, id));
      linesQuery = db
        .select()
        .from(tables.lines)
        .where(
          and(
            eq(tables.lines.prId, input.prId),
            eq(tables.lines.status, 'approved'),
            or(...lineConditions)
          )
        );
    }

    const lines = await linesQuery;

    if (lines.length === 0) {
      throw new Error('NO_LINES_TO_CONVERT');
    }

    // Calculate PO total
    let poTotal = 0;
    for (const line of lines) {
      poTotal += Number(line.lineTotal) || 0;
    }

    const now = getNow();

    // Generate PO number and create PO header in a transaction to prevent duplicates
    const MAX_PO_RETRIES = 3;
    let poNumber: string = '';
    let poId: number = 0;
    for (let attempt = 0; attempt < MAX_PO_RETRIES; attempt++) {
      try {
        const year = new Date().getFullYear();
        const poPrefix = `PO${year}-`;
        const lastPO = await db
          .select({ poNumber: tables.purchaseOrders.poNumber })
          .from(tables.purchaseOrders)
          .where(like(tables.purchaseOrders.poNumber, `${poPrefix}%`))
          .orderBy(desc(tables.purchaseOrders.id))
          .limit(1);

        let nextPONumber: string;
        if (lastPO.length === 0) {
          nextPONumber = `${poPrefix}0001`;
        } else {
          const seq = parseInt(lastPO[0].poNumber.replace(poPrefix, ''), 10);
          nextPONumber = `${poPrefix}${(seq + 1).toString().padStart(4, '0')}`;
        }

        const poResult = await db.insert(tables.purchaseOrders).values({
          poNumber: nextPONumber,
          vendorId: vendorId,
          status: 'draft',
          prId: input.prId,
          totalAmount: poTotal,
          deliveryDate: input.deliveryDate ? toDbDate(input.deliveryDate) : null,
          deliveryAddress: input.deliveryAddress || null,
          paymentTerms: input.paymentTerms || null,
          notes: input.notes || null,
          createdBy,
          createdAt: now,
          updatedAt: now,
        });

        poId = getInsertId(poResult);
        poNumber = nextPONumber;
        break;
      } catch (error: any) {
        if (attempt < MAX_PO_RETRIES - 1 && (error.code === 'ER_DUP_ENTRY' || error.message?.includes('UNIQUE constraint failed'))) {
          continue;
        }
        throw error;
      }
    }

    // Create PO lines and update PR lines
    let poLineNumber = 0;
    for (const prLine of lines) {
      poLineNumber++;

      // Create PO line (map PR line fields to PO line schema)
      const qty = Number(prLine.quantity) || 0;
      const price = Number(prLine.estimatedPrice) || 0;
      const poLineResult = await db.insert(tables.purchaseOrderLines).values({
        poId,
        itemId: prLine.itemId,
        quantity: qty,
        unit: prLine.unit || 'pcs',
        unitPrice: price,
        totalPrice: qty * price,
        notes: prLine.description || null,
        createdAt: now,
      });

      const poLineId = getInsertId(poLineResult);

      // Update PR line status
      await db
        .update(tables.lines)
        .set({
          status: 'converted',
          convertedPoLineId: poLineId,
        })
        .where(eq(tables.lines.id, prLine.id));
    }

    // Check if all lines are converted
    const remainingLines = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.lines)
      .where(
        and(
          eq(tables.lines.prId, input.prId),
          eq(tables.lines.status, 'approved')
        )
      );

    if (Number(remainingLines[0]?.count || 0) === 0) {
      // All lines converted, update PR status
      await db
        .update(tables.requisitions)
        .set({
          status: 'converted',
          updatedAt: now,
        })
        .where(eq(tables.requisitions.id, input.prId));
      prFullyConverted = true;
    }

    return {
      success: true,
      poId,
      poNumber,
      convertedLineCount: lines.length,
    };
  });

  // After commit: notify Metaherb ONLY when the PR itself reached 'converted'
  // (full conversion). Partial conversions don't change PR status → no webhook.
  // Fires only for Metaherb-originated PRs. Fire-and-forget.
  if (prFullyConverted) {
    void notifyMetaherbPrStatus(input.prId, 'converted', response.poNumber);
  }

  return response;
}

/**
 * Cancel a Purchase Requisition
 */
export async function cancelPR(prId: number, reason: string): Promise<void> {
  await executeDbOperation(async (db) => {
    const tables = getTables();

    const prResult = await db
      .select({ status: tables.requisitions.status })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.id, prId))
      .limit(1);

    if (prResult.length === 0) {
      throw new Error('PR_NOT_FOUND');
    }

    const status = prResult[0].status;
    if (status === 'converted' || status === 'cancelled') {
      throw new Error('PR_CANNOT_BE_CANCELLED');
    }

    await db
      .update(tables.requisitions)
      .set({
        status: 'cancelled',
        rejectionReason: reason,
        updatedAt: getNow(),
      })
      .where(eq(tables.requisitions.id, prId));
  });

  // After commit: notify Metaherb (fires only for Metaherb-originated PRs).
  void notifyMetaherbPrStatus(prId, 'cancelled');
}

/**
 * Get PR Dashboard Summary
 */
export async function getPRDashboard(userId?: number): Promise<PRDashboardSummary> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Draft count
    const draftWhereClause = userId
      ? and(
          eq(tables.requisitions.status, 'draft'),
          eq(tables.requisitions.requesterId, userId)
        )
      : eq(tables.requisitions.status, 'draft');

    const draftResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(draftWhereClause);
    const draftCount = Number(draftResult[0]?.count || 0);

    // Pending approval count
    const pendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.status, 'pending_approval'));
    const pendingApprovalCount = Number(pendingResult[0]?.count || 0);

    // Approved count
    const approvedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.status, 'approved'));
    const approvedCount = Number(approvedResult[0]?.count || 0);

    // Rejected count
    const rejectedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.status, 'rejected'));
    const rejectedCount = Number(rejectedResult[0]?.count || 0);

    // Total this month
    const monthResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(gte(tables.requisitions.createdAt, toDbDate(startOfMonth.toISOString().split('T')[0])));
    const totalThisMonth = Number(monthResult[0]?.count || 0);

    // Urgent pending
    const urgentResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(
        and(
          eq(tables.requisitions.status, 'pending_approval'),
          eq(tables.requisitions.priority, 'urgent')
        )
      );
    const urgentPending = Number(urgentResult[0]?.count || 0);

    return {
      draftCount,
      pendingApprovalCount,
      approvedCount,
      rejectedCount,
      totalThisMonth,
      avgProcessingDays: 0, // TODO: Calculate from historical data
      urgentPending,
    };
  });
}
