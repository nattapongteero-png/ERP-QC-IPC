/**
 * Purchase Requisition Service (T033-T036)
 * Part of 011-accounting-spec-gap
 */

import { eq, and, or, like, gte, lte, desc, asc, sql, isNull } from 'drizzle-orm';
import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow, toDbDate, formatDateFromDb } from '../db/date-utils';
import { submitForApproval, approveRequest, rejectRequest } from './approval-workflow.service';
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
  };
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
 */
export async function createPR(
  data: PRCreateInput,
  createdBy: number
): Promise<number> {
  return executeDbOperation(async (db) => {
    const tables = getTables();
    const prNumber = await generatePRNumber();
    const now = getNow();

    const result = await db.insert(tables.requisitions).values({
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
      totalEstimatedAmount: 0,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });

    return getInsertId(result);
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
        .select({ nameEn: tables.employees.nameEn })
        .from(tables.employees)
        .where(eq(tables.employees.id, pr.requesterId))
        .limit(1);
      if (empResult.length > 0) {
        requesterName = empResult[0].nameEn || '';
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

    return {
      ...pr,
      requesterName,
      departmentName,
      lines: lines.map((line: { quantity?: number | null; estimatedUnitPrice?: number | null; [key: string]: unknown }) => ({
        ...line,
        estimatedAmount: (line.quantity || 0) * (line.estimatedUnitPrice || 0),
      })),
    } as PRWithLines;
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
    const countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions);

    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    // Get data with pagination
    const dataQuery = db
      .select()
      .from(tables.requisitions)
      .orderBy(desc(tables.requisitions.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      dataQuery.where(and(...conditions));
    }

    const data = await dataQuery;

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
      const estimatedAmount = (line.quantity || 0) * (line.estimatedUnitPrice || 0);
      totalAmount += estimatedAmount;

      const result = await db.insert(tables.lines).values({
        prId,
        lineNumber,
        itemId: line.itemId || null,
        itemCode: line.itemCode || null,
        description: line.description,
        quantity: line.quantity,
        unitOfMeasure: line.unitOfMeasure,
        estimatedUnitPrice: line.estimatedUnitPrice || 0,
        estimatedAmount,
        suggestedVendorId: line.suggestedVendorId || null,
        notes: line.notes || null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
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
    const newQuantity = data.quantity ?? currentLine.quantity;
    const newUnitPrice = data.estimatedUnitPrice ?? currentLine.estimatedUnitPrice;
    const estimatedAmount = newQuantity * newUnitPrice;

    await db
      .update(tables.lines)
      .set({
        ...(data.itemId !== undefined && { itemId: data.itemId }),
        ...(data.itemCode !== undefined && { itemCode: data.itemCode }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unitOfMeasure !== undefined && { unitOfMeasure: data.unitOfMeasure }),
        ...(data.estimatedUnitPrice !== undefined && { estimatedUnitPrice: data.estimatedUnitPrice }),
        estimatedAmount,
        ...(data.suggestedVendorId !== undefined && { suggestedVendorId: data.suggestedVendorId }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: getNow(),
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
 * Recalculate PR total from lines
 */
async function recalculatePRTotal(prId: number): Promise<void> {
  return executeDbOperation(async (db) => {
    const tables = getTables();

    const sumResult = await db
      .select({ total: sql<number>`COALESCE(SUM(estimated_amount), 0)` })
      .from(tables.lines)
      .where(eq(tables.lines.prId, prId));

    const total = Number(sumResult[0]?.total || 0);

    await db
      .update(tables.requisitions)
      .set({
        totalEstimatedAmount: total,
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
      totalAmount: pr.totalEstimatedAmount,
      priority: pr.priority,
      departmentId: pr.departmentId,
    });

    // Update PR status
    const now = getNow();
    await db
      .update(tables.requisitions)
      .set({
        status: 'pending_approval',
        submittedAt: now,
        approvalRequestId: approvalResult.requestId,
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

    if (pr.status !== 'pending_approval') {
      throw new Error('PR_NOT_PENDING_APPROVAL');
    }

    if (!pr.approvalRequestId) {
      throw new Error('NO_APPROVAL_REQUEST');
    }

    // Approve in workflow
    const result = await approveRequest(pr.approvalRequestId, approverId, comments);

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

      // Mark all lines as approved
      await db
        .update(tables.lines)
        .set({
          status: 'approved',
          updatedAt: now,
        })
        .where(eq(tables.lines.prId, prId));
    }
  });
}

/**
 * Reject a Purchase Requisition
 */
export async function rejectPR(
  prId: number,
  approverId: number,
  reason: string
): Promise<void> {
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

    if (pr.status !== 'pending_approval') {
      throw new Error('PR_NOT_PENDING_APPROVAL');
    }

    if (!pr.approvalRequestId) {
      throw new Error('NO_APPROVAL_REQUEST');
    }

    // Reject in workflow
    await rejectRequest(pr.approvalRequestId, approverId, reason);

    // Update PR status
    const now = getNow();
    await db
      .update(tables.requisitions)
      .set({
        status: 'rejected',
        rejectedAt: now,
        rejectionReason: reason,
        updatedAt: now,
      })
      .where(eq(tables.requisitions.id, prId));

    // Mark all lines as rejected
    await db
      .update(tables.lines)
      .set({
        status: 'rejected',
        updatedAt: now,
      })
      .where(eq(tables.lines.prId, prId));
  });
}

/**
 * Convert approved PR to PO (T036)
 */
export async function convertPRToPO(
  input: PRToPOConvertInput,
  createdBy: number
): Promise<PRToPOConvertResponse> {
  return executeDbOperation(async (db) => {
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

    // Generate PO number
    const year = new Date().getFullYear();
    const poPrefix = `PO${year}-`;
    const lastPO = await db
      .select({ poNumber: tables.purchaseOrders.poNumber })
      .from(tables.purchaseOrders)
      .where(like(tables.purchaseOrders.poNumber, `${poPrefix}%`))
      .orderBy(desc(tables.purchaseOrders.id))
      .limit(1);

    let poNumber: string;
    if (lastPO.length === 0) {
      poNumber = `${poPrefix}0001`;
    } else {
      const seq = parseInt(lastPO[0].poNumber.replace(poPrefix, ''), 10);
      poNumber = `${poPrefix}${(seq + 1).toString().padStart(4, '0')}`;
    }

    // Calculate PO total
    let poTotal = 0;
    for (const line of lines) {
      poTotal += line.estimatedAmount || 0;
    }

    const now = getNow();

    // Create PO
    const poResult = await db.insert(tables.purchaseOrders).values({
      poNumber,
      vendorId: input.vendorId,
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

    const poId = getInsertId(poResult);

    // Create PO lines and update PR lines
    let poLineNumber = 0;
    for (const prLine of lines) {
      poLineNumber++;

      // Create PO line
      const poLineResult = await db.insert(tables.purchaseOrderLines).values({
        poId,
        lineNumber: poLineNumber,
        itemId: prLine.itemId,
        itemCode: prLine.itemCode,
        description: prLine.description,
        quantity: prLine.quantity,
        unitOfMeasure: prLine.unitOfMeasure,
        unitPrice: prLine.estimatedUnitPrice,
        amount: prLine.estimatedAmount,
        prLineId: prLine.id,
        createdAt: now,
        updatedAt: now,
      });

      const poLineId = getInsertId(poLineResult);

      // Update PR line status
      await db
        .update(tables.lines)
        .set({
          status: 'full_po',
          convertedPoId: poId,
          convertedPoLineId: poLineId,
          updatedAt: now,
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
    }

    return {
      success: true,
      poId,
      poNumber,
      convertedLineCount: lines.length,
    };
  });
}

/**
 * Cancel a Purchase Requisition
 */
export async function cancelPR(prId: number, reason: string): Promise<void> {
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
    const draftQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(tables.requisitions)
      .where(eq(tables.requisitions.status, 'draft'));

    if (userId) {
      draftQuery.where(
        and(
          eq(tables.requisitions.status, 'draft'),
          eq(tables.requisitions.requesterId, userId)
        )
      );
    }

    const draftResult = await draftQuery;
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
