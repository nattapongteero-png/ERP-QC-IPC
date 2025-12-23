/**
 * Change Control Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * Manages GMP-compliant change control with multi-department approval workflow,
 * implementation tracking, and audit trail.
 */

import { getDb, isSqlite } from '../db';
import { getNow, toDbDate } from '../db/date-utils';
import { eq, and, desc, like, count } from 'drizzle-orm';
import {
  sqliteChangeRequests,
  sqliteChangeApprovals,
  sqliteUsers,
  mysqlChangeRequests,
  mysqlChangeApprovals,
  mysqlUsers,
} from '../db/schema';
import { createAuditLog } from '../audit';
import type {
  ChangeRequest,
  ChangeRequestDetails,
  ChangeRequestCreate,
  ChangeRequestUpdate,
  ChangeRequestListParams,
  ChangeRequestListResponse,
  ChangeApproval,
  ApprovalRole,
  ChangeStatus,
  ChangeType,
  ChangePriority,
  ApprovalStatus,
} from '@/types/change-control';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      changeRequests: sqliteChangeRequests,
      changeApprovals: sqliteChangeApprovals,
      users: sqliteUsers,
    };
  }
  return {
    changeRequests: mysqlChangeRequests,
    changeApprovals: mysqlChangeApprovals,
    users: mysqlUsers,
  };
}

// Type for database query result rows
interface DbChangeRow {
  id: number;
  changeNumber: string;
  title: string;
  changeType: string;
  description: string | null;
  justification: string | null;
  impactAssessment: string | null;
  riskAssessment: string | null;
  status: string;
  priority: string;
  requesterId: number | null;
  requesterName: string | null;
  ownerId: number | null;
  ownerName: string | null;
  targetDate: string | null;
  implementedDate: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface DbApprovalRow {
  id: number;
  changeId: number;
  approverId: number | null;
  approverName: string | null;
  role: string;
  status: string;
  comments: string | null;
  signedAt: string | null;
  createdAt: string | Date;
}

// Helper to convert Date objects to string for consistency
function toDateString(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

// ============================================
// Number Generation
// ============================================

/**
 * Generate next change number (CC-YYMM-####)
 */
export async function generateChangeNumber(): Promise<string> {
  const { changeRequests } = getTables();
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `CC-${year}${month}-`;

  // Get the latest change number for this month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await ((await getDb()) as any)
    .select({ changeNumber: changeRequests.changeNumber })
    .from(changeRequests)
    .where(like(changeRequests.changeNumber, `${prefix}%`))
    .orderBy(desc(changeRequests.changeNumber))
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].changeNumber;
    const numPart = parseInt(lastNumber.split('-')[2], 10);
    nextNumber = numPart + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ============================================
// Change Request CRUD Operations
// ============================================

/**
 * Create a new change request
 */
export async function createChangeRequest(
  data: ChangeRequestCreate,
  userId: number
): Promise<ChangeRequest> {
  const { changeRequests } = getTables();
  const db = await getDb();
  const changeNumber = await generateChangeNumber();
  const now = getNow();

  let changeId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(changeRequests)
      .values({
        changeNumber,
        title: data.title,
        changeType: data.changeType,
        description: data.description || null,
        justification: data.justification || null,
        impactAssessment: data.impactAssessment || null,
        riskAssessment: data.riskAssessment || null,
        status: 'draft',
        priority: data.priority || 'medium',
        requesterId: userId,
        ownerId: data.ownerId,
        targetDate: data.targetDate ? toDbDate(data.targetDate) : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: changeRequests.id });
    changeId = result[0].id;
  } else {
    // MySQL - insert and get last insert ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(changeRequests)
      .values({
        changeNumber,
        title: data.title,
        changeType: data.changeType,
        description: data.description || null,
        justification: data.justification || null,
        impactAssessment: data.impactAssessment || null,
        riskAssessment: data.riskAssessment || null,
        status: 'draft',
        priority: data.priority || 'medium',
        requesterId: userId,
        ownerId: data.ownerId,
        targetDate: data.targetDate ? toDbDate(data.targetDate) : null,
        createdAt: now,
        updatedAt: now,
      });
    // Get the inserted change by changeNumber
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: changeRequests.id })
      .from(changeRequests)
      .where(eq(changeRequests.changeNumber, changeNumber))
      .limit(1);
    changeId = inserted[0].id;
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'change_requests',
    recordId: changeId,
    newValue: { changeNumber, title: data.title, changeType: data.changeType },
  });

  const createdChange = await getChangeRequestById(changeId);
  return createdChange!;
}

/**
 * Get change request by ID
 */
export async function getChangeRequestById(id: number): Promise<ChangeRequestDetails | null> {
  const { changeRequests, changeApprovals, users } = getTables();
  const db = await getDb();

  // Get change request with related user data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db as any)
    .select({
      id: changeRequests.id,
      changeNumber: changeRequests.changeNumber,
      title: changeRequests.title,
      changeType: changeRequests.changeType,
      description: changeRequests.description,
      justification: changeRequests.justification,
      impactAssessment: changeRequests.impactAssessment,
      riskAssessment: changeRequests.riskAssessment,
      status: changeRequests.status,
      priority: changeRequests.priority,
      requesterId: changeRequests.requesterId,
      requesterName: users.name,
      ownerId: changeRequests.ownerId,
      targetDate: changeRequests.targetDate,
      implementedDate: changeRequests.implementedDate,
      createdAt: changeRequests.createdAt,
      updatedAt: changeRequests.updatedAt,
    })
    .from(changeRequests)
    .leftJoin(users, eq(changeRequests.requesterId, users.id))
    .where(eq(changeRequests.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const changeRow = result[0] as DbChangeRow;

  // Get owner name separately
  let ownerName: string | undefined;
  if (changeRow.ownerId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const owner = await (db as any)
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, changeRow.ownerId))
      .limit(1);
    ownerName = owner[0]?.name || undefined;
  }

  // Get approvals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvalsResult = await (db as any)
    .select({
      id: changeApprovals.id,
      changeId: changeApprovals.changeId,
      approverId: changeApprovals.approverId,
      approverName: users.name,
      role: changeApprovals.role,
      status: changeApprovals.status,
      comments: changeApprovals.comments,
      signedAt: changeApprovals.signedAt,
      createdAt: changeApprovals.createdAt,
    })
    .from(changeApprovals)
    .leftJoin(users, eq(changeApprovals.approverId, users.id))
    .where(eq(changeApprovals.changeId, id))
    .orderBy(desc(changeApprovals.createdAt));

  const approvals: ChangeApproval[] = approvalsResult.map((row: DbApprovalRow) => ({
    id: row.id,
    changeId: row.changeId,
    approverId: row.approverId,
    approverName: row.approverName || undefined,
    role: row.role as ApprovalRole,
    status: row.status as ApprovalStatus,
    comments: row.comments,
    signedAt: row.signedAt ? toDateString(row.signedAt) : null,
    createdAt: toDateString(row.createdAt),
  }));

  return {
    id: changeRow.id,
    changeNumber: changeRow.changeNumber,
    title: changeRow.title,
    changeType: changeRow.changeType as ChangeType,
    description: changeRow.description,
    justification: changeRow.justification,
    impactAssessment: changeRow.impactAssessment,
    riskAssessment: changeRow.riskAssessment,
    status: changeRow.status as ChangeStatus,
    priority: changeRow.priority as ChangePriority,
    requesterId: changeRow.requesterId,
    requesterName: changeRow.requesterName || undefined,
    ownerId: changeRow.ownerId,
    ownerName,
    targetDate: changeRow.targetDate ? toDateString(changeRow.targetDate) : null,
    implementedDate: changeRow.implementedDate ? toDateString(changeRow.implementedDate) : null,
    createdAt: toDateString(changeRow.createdAt),
    updatedAt: toDateString(changeRow.updatedAt),
    approvals,
  };
}

/**
 * List change requests with optional filtering and pagination
 */
export async function listChangeRequests(
  params: ChangeRequestListParams = {}
): Promise<ChangeRequestListResponse> {
  const { status, changeType, priority, ownerId, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const { changeRequests, users } = getTables();
  const db = await getDb();

  // Build query conditions
  const conditions = [];
  if (status) conditions.push(eq(changeRequests.status, status));
  if (changeType) conditions.push(eq(changeRequests.changeType, changeType));
  if (priority) conditions.push(eq(changeRequests.priority, priority));
  if (ownerId) conditions.push(eq(changeRequests.ownerId, ownerId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countResult = await (db as any)
    .select({ count: count() })
    .from(changeRequests)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Get change requests with user info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const changesResult = await (db as any)
    .select({
      id: changeRequests.id,
      changeNumber: changeRequests.changeNumber,
      title: changeRequests.title,
      changeType: changeRequests.changeType,
      description: changeRequests.description,
      justification: changeRequests.justification,
      impactAssessment: changeRequests.impactAssessment,
      riskAssessment: changeRequests.riskAssessment,
      status: changeRequests.status,
      priority: changeRequests.priority,
      requesterId: changeRequests.requesterId,
      requesterName: users.name,
      ownerId: changeRequests.ownerId,
      targetDate: changeRequests.targetDate,
      implementedDate: changeRequests.implementedDate,
      createdAt: changeRequests.createdAt,
      updatedAt: changeRequests.updatedAt,
    })
    .from(changeRequests)
    .leftJoin(users, eq(changeRequests.requesterId, users.id))
    .where(whereClause)
    .orderBy(desc(changeRequests.createdAt))
    .limit(limit)
    .offset(offset);

  // Get owner names for each change
  const changes: ChangeRequest[] = await Promise.all(
    changesResult.map(async (changeRow: DbChangeRow) => {
      let ownerName: string | undefined;
      if (changeRow.ownerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const owner = await (db as any)
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, changeRow.ownerId))
          .limit(1);
        ownerName = owner[0]?.name || undefined;
      }

      return {
        id: changeRow.id,
        changeNumber: changeRow.changeNumber,
        title: changeRow.title,
        changeType: changeRow.changeType as ChangeType,
        description: changeRow.description,
        justification: changeRow.justification,
        impactAssessment: changeRow.impactAssessment,
        riskAssessment: changeRow.riskAssessment,
        status: changeRow.status as ChangeStatus,
        priority: changeRow.priority as ChangePriority,
        requesterId: changeRow.requesterId,
        requesterName: changeRow.requesterName || undefined,
        ownerId: changeRow.ownerId,
        ownerName,
        targetDate: changeRow.targetDate ? toDateString(changeRow.targetDate) : null,
        implementedDate: changeRow.implementedDate ? toDateString(changeRow.implementedDate) : null,
        createdAt: toDateString(changeRow.createdAt),
        updatedAt: toDateString(changeRow.updatedAt),
      } as ChangeRequest;
    })
  );

  return { changes, total };
}

/**
 * Update change request
 */
export async function updateChangeRequest(
  id: number,
  data: ChangeRequestUpdate,
  userId: number
): Promise<ChangeRequest> {
  const { changeRequests } = getTables();
  const db = await getDb();

  const existing = await getChangeRequestById(id);
  if (!existing) {
    throw new Error('Change request not found');
  }

  // Only allow updates to draft changes
  if (existing.status !== 'draft') {
    throw new Error('Cannot update change request that is not in draft status');
  }

  const now = getNow();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.justification !== undefined) updateData.justification = data.justification;
  if (data.impactAssessment !== undefined) updateData.impactAssessment = data.impactAssessment;
  if (data.riskAssessment !== undefined) updateData.riskAssessment = data.riskAssessment;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;
  if (data.targetDate !== undefined) updateData.targetDate = toDbDate(data.targetDate);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(changeRequests)
    .set(updateData)
    .where(eq(changeRequests.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'change_requests',
    recordId: id,
    oldValue: { status: existing.status, priority: existing.priority },
    newValue: updateData,
  });

  const updated = await getChangeRequestById(id);
  return updated!;
}

// ============================================
// Approval Workflow
// ============================================

/**
 * Submit change request for review - initiates approval workflow
 */
export async function submitChangeForReview(
  id: number,
  userId: number
): Promise<ChangeRequestDetails> {
  const { changeRequests, changeApprovals } = getTables();
  const db = await getDb();

  const existing = await getChangeRequestById(id);
  if (!existing) {
    throw new Error('Change request not found');
  }

  if (existing.status !== 'draft') {
    throw new Error('Only draft changes can be submitted for review');
  }

  // Validate required fields
  if (!existing.justification) {
    throw new Error('Justification is required before submitting for review');
  }
  if (!existing.impactAssessment) {
    throw new Error('Impact assessment is required before submitting for review');
  }
  if (!existing.riskAssessment) {
    throw new Error('Risk assessment is required before submitting for review');
  }

  const now = getNow();

  // Update change status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(changeRequests)
    .set({
      status: 'pending_review',
      updatedAt: now,
    })
    .where(eq(changeRequests.id, id));

  // Create approval records for each required role
  const approvalRoles: ApprovalRole[] = ['qa', 'production', 'regulatory', 'management'];

  for (const role of approvalRoles) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(changeApprovals)
      .values({
        changeId: id,
        approverId: null, // Will be assigned when someone approves
        role,
        status: 'pending',
        createdAt: now,
      });
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'change_requests',
    recordId: id,
    newValue: { action: 'submit_for_review', status: 'pending_review' },
  });

  const updated = await getChangeRequestById(id);
  return updated!;
}

/**
 * Approve change - multi-department approval support
 */
export async function approveChange(
  id: number,
  approverId: number,
  role: ApprovalRole,
  approved: boolean,
  comments?: string
): Promise<ChangeRequestDetails> {
  const { changeRequests, changeApprovals } = getTables();
  const db = await getDb();

  const existing = await getChangeRequestById(id);
  if (!existing) {
    throw new Error('Change request not found');
  }

  if (existing.status !== 'pending_review') {
    throw new Error('Change is not pending review');
  }

  // Find pending approval for this role
  const pendingApproval = existing.approvals.find(
    (a) => a.role === role && a.status === 'pending'
  );

  if (!pendingApproval) {
    throw new Error(`No pending approval found for role: ${role}`);
  }

  const now = getNow();
  const newStatus: ApprovalStatus = approved ? 'approved' : 'rejected';

  // Update approval record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(changeApprovals)
    .set({
      approverId,
      status: newStatus,
      comments: comments || null,
      signedAt: now,
    })
    .where(eq(changeApprovals.id, pendingApproval.id));

  // Create audit log for approval
  await createAuditLog({
    userId: approverId,
    action: 'UPDATE',
    tableName: 'change_approvals',
    recordId: pendingApproval.id,
    newValue: { role, status: newStatus, comments },
  });

  // Check if all approvals are complete
  const updatedChange = await getChangeRequestById(id);
  if (!updatedChange) {
    throw new Error('Failed to get updated change request');
  }

  const allApproved = updatedChange.approvals.every((a) => a.status === 'approved');
  const anyRejected = updatedChange.approvals.some((a) => a.status === 'rejected');

  let changeStatus: ChangeStatus = 'pending_review';

  if (anyRejected) {
    changeStatus = 'rejected';
  } else if (allApproved) {
    changeStatus = 'approved';
  }

  // Update change status if all approvals are processed
  if (changeStatus !== 'pending_review') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(changeRequests)
      .set({
        status: changeStatus,
        updatedAt: now,
      })
      .where(eq(changeRequests.id, id));

    // Create audit log for status change
    await createAuditLog({
      userId: approverId,
      action: 'UPDATE',
      tableName: 'change_requests',
      recordId: id,
      newValue: { action: 'approval_complete', status: changeStatus },
    });
  }

  const finalChange = await getChangeRequestById(id);
  return finalChange!;
}

/**
 * Implement change - mark as implemented with notes
 */
export async function implementChange(
  id: number,
  userId: number,
  implementationNotes?: string
): Promise<ChangeRequestDetails> {
  const { changeRequests } = getTables();
  const db = await getDb();

  const existing = await getChangeRequestById(id);
  if (!existing) {
    throw new Error('Change request not found');
  }

  if (existing.status !== 'approved') {
    throw new Error('Only approved changes can be implemented');
  }

  const now = getNow();

  // Update change to implemented status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(changeRequests)
    .set({
      status: 'implemented',
      implementedDate: now,
      updatedAt: now,
    })
    .where(eq(changeRequests.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'change_requests',
    recordId: id,
    newValue: {
      action: 'implement',
      status: 'implemented',
      implementationNotes,
      implementedDate: now,
    },
  });

  const updated = await getChangeRequestById(id);
  return updated!;
}

/**
 * Close change after effectiveness verification
 */
export async function closeChange(
  id: number,
  userId: number,
  closureNotes?: string
): Promise<ChangeRequestDetails> {
  const { changeRequests } = getTables();
  const db = await getDb();

  const existing = await getChangeRequestById(id);
  if (!existing) {
    throw new Error('Change request not found');
  }

  if (existing.status !== 'implemented') {
    throw new Error('Only implemented changes can be closed');
  }

  if (!existing.implementedDate) {
    throw new Error('Change must have an implementation date before closing');
  }

  const now = getNow();

  // Update change to closed status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(changeRequests)
    .set({
      status: 'closed',
      updatedAt: now,
    })
    .where(eq(changeRequests.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'change_requests',
    recordId: id,
    newValue: {
      action: 'close',
      status: 'closed',
      closureNotes,
    },
  });

  const updated = await getChangeRequestById(id);
  return updated!;
}
