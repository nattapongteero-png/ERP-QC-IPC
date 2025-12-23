/**
 * CAPA Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Manages Corrective and Preventive Actions (CAPA) with action tracking,
 * effectiveness verification, and audit trail.
 */

import { getDb, isSqlite } from '../db';
import { eq, and, desc, asc, lte, like, or, count } from 'drizzle-orm';
import {
  sqliteCapa,
  sqliteCapaActions,
  sqliteCapaEffectiveness,
  sqliteDeviations,
  sqliteUsers,
  mysqlCapa,
  mysqlCapaActions,
  mysqlCapaEffectiveness,
  mysqlDeviations,
  mysqlUsers,
} from '../db/schema';

// Get table references based on database type
function getTables() {
  if (isSqlite()) {
    return {
      capa: sqliteCapa,
      actions: sqliteCapaActions,
      effectiveness: sqliteCapaEffectiveness,
      deviations: sqliteDeviations,
      users: sqliteUsers,
    };
  }
  return {
    capa: mysqlCapa,
    actions: mysqlCapaActions,
    effectiveness: mysqlCapaEffectiveness,
    deviations: mysqlDeviations,
    users: mysqlUsers,
  };
}
import { createAuditLog } from '../audit';
import type {
  CapaSourceType,
  CapaType,
  CapaPriority,
  CapaStatus,
  CapaActionType,
  CapaActionStatus,
  CapaEffectivenessResult,
  Capa,
  CapaCreate,
  CapaUpdate,
  CapaDetails,
  CapaAction,
  CapaActionCreate,
  CapaActionUpdate,
  CapaEffectiveness,
  CapaEffectivenessCreate,
  CapaDashboard,
  CapaListParams,
  CapaListResponse,
} from '@/types/capa';

// Type for database query result rows
interface DbCapaRow {
  id: number;
  capaNumber: string;
  title: string;
  sourceType: string;
  sourceId: number | null;
  deviationId: number | null;
  complaintId: number | null;
  auditFindingId: number | null;
  type: string;
  priority: string;
  status: string;
  rootCauseAnalysis: string | null;
  rootCauseCategory: string | null;
  dueDate: string | null;
  closedDate: string | null;
  ownerId: number | null;
  ownerName: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbCapaActionRow {
  id: number;
  capaId: number;
  actionNumber: number;
  description: string;
  actionType: string;
  assigneeId: number | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: string;
  completionNotes: string | null;
  completedAt: string | null;
  verifiedBy: number | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
}

interface DbCapaEffectivenessRow {
  id: number;
  capaId: number;
  checkNumber: number;
  checkDate: string | null;
  verifierId: number | null;
  verifierName: string | null;
  criteria: string | null;
  result: string | null;
  evidence: string | null;
  followUpRequired: boolean | null;
  notes: string | null;
}

// ============================================
// Number Generation
// ============================================

/**
 * Generate next CAPA number (CAPA-YYMM-####)
 */
export async function generateCapaNumber(): Promise<string> {
  const { capa } = getTables();
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `CAPA-${year}${month}-`;

  // Get the latest CAPA number for this month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await ((await getDb()) as any)
    .select({ capaNumber: capa.capaNumber })
    .from(capa)
    .where(like(capa.capaNumber, `${prefix}%`))
    .orderBy(desc(capa.capaNumber))
    .limit(1);

  let nextNumber = 1;
  if (result.length > 0) {
    const lastNumber = result[0].capaNumber;
    const numPart = parseInt(lastNumber.split('-')[2], 10);
    nextNumber = numPart + 1;
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ============================================
// CAPA CRUD Operations
// ============================================

/**
 * List CAPAs with optional filtering and pagination
 */
export async function listCapas(
  params: CapaListParams = {}
): Promise<CapaListResponse> {
  const { status, type, priority, sourceType, ownerId, overdue, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const { capa, actions, users } = getTables();
  const db = await getDb();

  // Build query conditions
  const conditions = [];
  if (status) conditions.push(eq(capa.status, status));
  if (type) conditions.push(eq(capa.type, type));
  if (priority) conditions.push(eq(capa.priority, priority));
  if (sourceType) conditions.push(eq(capa.sourceType, sourceType));
  if (ownerId) conditions.push(eq(capa.ownerId, ownerId));

  const today = new Date().toISOString().split('T')[0];
  if (overdue) {
    conditions.push(
      and(
        lte(capa.dueDate, today),
        or(
          eq(capa.status, 'open'),
          eq(capa.status, 'investigation'),
          eq(capa.status, 'action_pending'),
          eq(capa.status, 'verification')
        )
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countResult = await (db as any)
    .select({ count: count() })
    .from(capa)
    .where(whereClause);
  const total = countResult[0]?.count || 0;

  // Get CAPAs with user info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capas = await (db as any)
    .select({
      id: capa.id,
      capaNumber: capa.capaNumber,
      title: capa.title,
      sourceType: capa.sourceType,
      sourceId: capa.sourceId,
      deviationId: capa.deviationId,
      complaintId: capa.complaintId,
      auditFindingId: capa.auditFindingId,
      type: capa.type,
      priority: capa.priority,
      status: capa.status,
      rootCauseAnalysis: capa.rootCauseAnalysis,
      rootCauseCategory: capa.rootCauseCategory,
      dueDate: capa.dueDate,
      closedDate: capa.closedDate,
      ownerId: capa.ownerId,
      ownerName: users.name,
      createdBy: capa.createdBy,
      createdAt: capa.createdAt,
      updatedAt: capa.updatedAt,
    })
    .from(capa)
    .leftJoin(users, eq(capa.ownerId, users.id))
    .where(whereClause)
    .orderBy(desc(capa.createdAt))
    .limit(limit)
    .offset(offset);

  // Add action counts and overdue status
  const capaList: Capa[] = await Promise.all(
    capas.map(async (capaRow: DbCapaRow) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actionList = await (db as any)
        .select({ status: actions.status })
        .from(actions)
        .where(eq(actions.capaId, capaRow.id));

      const actionCount = actionList.length;
      const actionsCompleted = actionList.filter((a: { status: string }) => a.status === 'completed').length;
      const isOverdue = capaRow.dueDate && capaRow.dueDate < today &&
        !['closed', 'cancelled'].includes(capaRow.status);

      return {
        ...capaRow,
        sourceType: capaRow.sourceType as CapaSourceType,
        type: capaRow.type as CapaType,
        priority: capaRow.priority as CapaPriority,
        status: capaRow.status as CapaStatus,
        actionCount,
        actionsCompleted,
        isOverdue,
      } as Capa;
    })
  );

  return { capas: capaList, total };
}

/**
 * Get CAPA by ID with basic info
 */
export async function getCapaById(id: number): Promise<Capa | null> {
  const { capa: capaTable, users } = getTables();
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (db as any)
    .select({
      id: capaTable.id,
      capaNumber: capaTable.capaNumber,
      title: capaTable.title,
      sourceType: capaTable.sourceType,
      sourceId: capaTable.sourceId,
      deviationId: capaTable.deviationId,
      complaintId: capaTable.complaintId,
      auditFindingId: capaTable.auditFindingId,
      type: capaTable.type,
      priority: capaTable.priority,
      status: capaTable.status,
      rootCauseAnalysis: capaTable.rootCauseAnalysis,
      rootCauseCategory: capaTable.rootCauseCategory,
      dueDate: capaTable.dueDate,
      closedDate: capaTable.closedDate,
      ownerId: capaTable.ownerId,
      ownerName: users.name,
      createdBy: capaTable.createdBy,
      createdAt: capaTable.createdAt,
      updatedAt: capaTable.updatedAt,
    })
    .from(capaTable)
    .leftJoin(users, eq(capaTable.ownerId, users.id))
    .where(eq(capaTable.id, id))
    .limit(1);

  if (result.length === 0) return null;

  const capaRow = result[0] as DbCapaRow;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = capaRow.dueDate && capaRow.dueDate < today &&
    !['closed', 'cancelled'].includes(capaRow.status);

  return {
    ...capaRow,
    sourceType: capaRow.sourceType as CapaSourceType,
    type: capaRow.type as CapaType,
    priority: capaRow.priority as CapaPriority,
    status: capaRow.status as CapaStatus,
    isOverdue,
  } as Capa;
}

/**
 * Get CAPA with full details including actions and effectiveness checks
 */
export async function getCapaDetails(id: number): Promise<CapaDetails | null> {
  const capaData = await getCapaById(id);
  if (!capaData) return null;

  const { actions: actionsTable, effectiveness, users, deviations } = getTables();
  const db = await getDb();

  // Get actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionsResult = await (db as any)
    .select({
      id: actionsTable.id,
      capaId: actionsTable.capaId,
      actionNumber: actionsTable.actionNumber,
      description: actionsTable.description,
      actionType: actionsTable.actionType,
      assigneeId: actionsTable.assigneeId,
      assigneeName: users.name,
      dueDate: actionsTable.dueDate,
      status: actionsTable.status,
      completionNotes: actionsTable.completionNotes,
      completedAt: actionsTable.completedAt,
      verifiedBy: actionsTable.verifiedBy,
      verifiedAt: actionsTable.verifiedAt,
    })
    .from(actionsTable)
    .leftJoin(users, eq(actionsTable.assigneeId, users.id))
    .where(eq(actionsTable.capaId, id))
    .orderBy(asc(actionsTable.actionNumber));

  // Get verifier names for actions
  const actions: CapaAction[] = await Promise.all(
    actionsResult.map(async (action: DbCapaActionRow) => {
      let verifiedByName: string | undefined;
      if (action.verifiedBy) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const verifier = await (db as any)
          .select({ displayName: users.name })
          .from(users)
          .where(eq(users.id, action.verifiedBy))
          .limit(1);
        verifiedByName = verifier[0]?.displayName || undefined;
      }

      return {
        ...action,
        actionType: action.actionType as CapaActionType,
        status: action.status as CapaActionStatus,
        assigneeName: action.assigneeName || undefined,
        verifiedByName,
      } as CapaAction;
    })
  );

  // Get effectiveness checks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const effectivenessResult = await (db as any)
    .select({
      id: effectiveness.id,
      capaId: effectiveness.capaId,
      checkNumber: effectiveness.checkNumber,
      checkDate: effectiveness.checkDate,
      verifierId: effectiveness.verifierId,
      verifierName: users.name,
      criteria: effectiveness.criteria,
      result: effectiveness.result,
      evidence: effectiveness.evidence,
      followUpRequired: effectiveness.followUpRequired,
      notes: effectiveness.notes,
    })
    .from(effectiveness)
    .leftJoin(users, eq(effectiveness.verifierId, users.id))
    .where(eq(effectiveness.capaId, id))
    .orderBy(asc(effectiveness.checkNumber));

  const effectivenessChecks: CapaEffectiveness[] = effectivenessResult.map(
    (check: DbCapaEffectivenessRow) => ({
      ...check,
      checkDate: check.checkDate || '',
      verifierId: check.verifierId || 0,
      verifierName: check.verifierName || undefined,
      criteria: check.criteria || '',
      result: (check.result || 'effective') as CapaEffectivenessResult,
      followUpRequired: check.followUpRequired || false,
    })
  );

  // Get source details if applicable
  let source: object | undefined;
  if (capaData.deviationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deviation = await (db as any)
      .select()
      .from(deviations)
      .where(eq(deviations.id, capaData.deviationId))
      .limit(1);
    if (deviation.length > 0) {
      source = deviation[0];
    }
  }

  return {
    ...capaData,
    actions,
    effectivenessChecks,
    source,
  };
}

/**
 * Create a new CAPA
 */
export async function createCapa(
  data: CapaCreate,
  userId: number
): Promise<Capa> {
  const { capa: capaTable } = getTables();
  const db = await getDb();
  const capaNumber = await generateCapaNumber();
  const now = new Date().toISOString();

  // Determine source IDs based on sourceType
  let deviationId: number | null = null;
  let complaintId: number | null = null;
  let auditFindingId: number | null = null;

  if (data.sourceId) {
    switch (data.sourceType) {
      case 'deviation':
        deviationId = data.sourceId;
        break;
      case 'complaint':
        complaintId = data.sourceId;
        break;
      case 'audit_finding':
        auditFindingId = data.sourceId;
        break;
    }
  }

  let capaId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(capaTable)
      .values({
        capaNumber,
        title: data.title,
        sourceType: data.sourceType,
        sourceId: data.sourceId || null,
        deviationId,
        complaintId,
        auditFindingId,
        type: data.type,
        priority: data.priority,
        status: 'open',
        rootCauseAnalysis: data.rootCauseAnalysis || null,
        rootCauseCategory: data.rootCauseCategory || null,
        dueDate: data.dueDate,
        ownerId: data.ownerId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: capaTable.id });
    capaId = result[0].id;
  } else {
    // MySQL - insert and get last insert ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(capaTable)
      .values({
        capaNumber,
        title: data.title,
        sourceType: data.sourceType,
        sourceId: data.sourceId || null,
        deviationId,
        complaintId,
        auditFindingId,
        type: data.type,
        priority: data.priority,
        status: 'open',
        rootCauseAnalysis: data.rootCauseAnalysis || null,
        rootCauseCategory: data.rootCauseCategory || null,
        dueDate: data.dueDate,
        ownerId: data.ownerId,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    // Get the inserted CAPA by capaNumber
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: capaTable.id })
      .from(capaTable)
      .where(eq(capaTable.capaNumber, capaNumber))
      .limit(1);
    capaId = inserted[0].id;
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'capa',
    recordId: capaId,
    newValue: { capaNumber, title: data.title },
  });

  const createdCapa = await getCapaById(capaId);
  return createdCapa!;
}

/**
 * Create CAPA from a deviation
 */
export async function createFromDeviation(
  deviationId: number,
  capaData: Omit<CapaCreate, 'sourceType' | 'sourceId'>,
  userId: number
): Promise<Capa> {
  const { deviations } = getTables();
  const db = await getDb();

  // Verify deviation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviation = await (db as any)
    .select()
    .from(deviations)
    .where(eq(deviations.id, deviationId))
    .limit(1);

  if (deviation.length === 0) {
    throw new Error('Deviation not found');
  }

  // Create CAPA linked to deviation
  const capa = await createCapa(
    {
      ...capaData,
      sourceType: 'deviation',
      sourceId: deviationId,
    },
    userId
  );

  // Create audit log for deviation link
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'capa',
    recordId: capa.id,
    newValue: { deviationId, deviationNumber: deviation[0].deviationNumber },
  });

  return capa;
}

/**
 * Update CAPA
 */
export async function updateCapa(
  id: number,
  data: CapaUpdate,
  userId: number
): Promise<Capa> {
  const { capa: capaTable } = getTables();
  const db = await getDb();

  const existing = await getCapaById(id);
  if (!existing) {
    throw new Error('CAPA not found');
  }

  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.rootCauseAnalysis !== undefined) updateData.rootCauseAnalysis = data.rootCauseAnalysis;
  if (data.rootCauseCategory !== undefined) updateData.rootCauseCategory = data.rootCauseCategory;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(capaTable)
    .set(updateData)
    .where(eq(capaTable.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'capa',
    recordId: id,
    oldValue: { status: existing.status, priority: existing.priority },
    newValue: updateData,
  });

  const updated = await getCapaById(id);
  return updated!;
}

/**
 * Close CAPA
 */
export async function closeCapa(
  id: number,
  closureNotes: string | null,
  userId: number
): Promise<Capa> {
  const { capa: capaTable } = getTables();
  const db = await getDb();

  const existing = await getCapaDetails(id);
  if (!existing) {
    throw new Error('CAPA not found');
  }

  // Verify all actions are completed or verified
  const incompleteActions = existing.actions.filter(
    (a: CapaAction) => !['completed'].includes(a.status)
  );
  if (incompleteActions.length > 0) {
    throw new Error(`Cannot close CAPA: ${incompleteActions.length} action(s) not completed`);
  }

  // Verify at least one effectiveness check exists and is effective
  const effectiveChecks = existing.effectivenessChecks.filter(
    (e: CapaEffectiveness) => e.result === 'effective'
  );
  if (effectiveChecks.length === 0) {
    throw new Error('Cannot close CAPA: No effective verification recorded');
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(capaTable)
    .set({
      status: 'closed',
      closedDate: now,
      updatedAt: now,
    })
    .where(eq(capaTable.id, id));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'capa',
    recordId: id,
    newValue: { closedDate: now, closureNotes },
  });

  const closed = await getCapaById(id);
  return closed!;
}

// ============================================
// CAPA Actions
// ============================================

/**
 * Add action to CAPA
 */
export async function addAction(
  capaId: number,
  data: CapaActionCreate,
  userId: number
): Promise<CapaAction> {
  const { capa: capaTable, actions: actionsTable, users } = getTables();
  const db = await getDb();

  // Verify CAPA exists
  const capa = await getCapaById(capaId);
  if (!capa) {
    throw new Error('CAPA not found');
  }

  // Get next action number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingActions = await (db as any)
    .select({ actionNumber: actionsTable.actionNumber })
    .from(actionsTable)
    .where(eq(actionsTable.capaId, capaId))
    .orderBy(desc(actionsTable.actionNumber))
    .limit(1);

  const nextActionNumber = existingActions.length > 0 ? existingActions[0].actionNumber + 1 : 1;
  const now = new Date().toISOString();

  let actionId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(actionsTable)
      .values({
        capaId,
        actionNumber: nextActionNumber,
        description: data.description,
        actionType: data.actionType,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        status: 'pending',
        createdAt: now,
      })
      .returning({ id: actionsTable.id });
    actionId = result[0].id;
  } else {
    // MySQL - insert and get by capaId and actionNumber
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(actionsTable)
      .values({
        capaId,
        actionNumber: nextActionNumber,
        description: data.description,
        actionType: data.actionType,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        status: 'pending',
        createdAt: now,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: actionsTable.id })
      .from(actionsTable)
      .where(and(eq(actionsTable.capaId, capaId), eq(actionsTable.actionNumber, nextActionNumber)))
      .limit(1);
    actionId = inserted[0].id;
  }

  // Update CAPA status to action_pending if still in investigation
  if (['open', 'investigation'].includes(capa.status)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(capaTable)
      .set({ status: 'action_pending', updatedAt: now })
      .where(eq(capaTable.id, capaId));
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'CREATE',
    tableName: 'capa_actions',
    recordId: actionId,
    newValue: { capaId, actionNumber: nextActionNumber, description: data.description },
  });

  // Fetch and return the action with assignee name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionResult = await (db as any)
    .select({
      id: actionsTable.id,
      capaId: actionsTable.capaId,
      actionNumber: actionsTable.actionNumber,
      description: actionsTable.description,
      actionType: actionsTable.actionType,
      assigneeId: actionsTable.assigneeId,
      assigneeName: users.name,
      dueDate: actionsTable.dueDate,
      status: actionsTable.status,
      completionNotes: actionsTable.completionNotes,
      completedAt: actionsTable.completedAt,
      verifiedBy: actionsTable.verifiedBy,
      verifiedAt: actionsTable.verifiedAt,
    })
    .from(actionsTable)
    .leftJoin(users, eq(actionsTable.assigneeId, users.id))
    .where(eq(actionsTable.id, actionId))
    .limit(1);

  const action = actionResult[0] as DbCapaActionRow;
  return {
    ...action,
    actionType: action.actionType as CapaActionType,
    status: action.status as CapaActionStatus,
    assigneeName: action.assigneeName || undefined,
  } as CapaAction;
}

/**
 * Update action status and notes
 */
export async function updateAction(
  actionId: number,
  data: CapaActionUpdate,
  userId: number
): Promise<CapaAction> {
  const { actions: actionsTable, users } = getTables();
  const db = await getDb();

  // Get existing action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any)
    .select()
    .from(actionsTable)
    .where(eq(actionsTable.id, actionId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Action not found');
  }

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.completionNotes !== undefined) updateData.completionNotes = data.completionNotes;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

  // If marking as completed, set completedAt
  if (data.status === 'completed') {
    updateData.completedAt = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(actionsTable)
    .set(updateData)
    .where(eq(actionsTable.id, actionId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'capa_actions',
    recordId: actionId,
    oldValue: { status: existing[0].status },
    newValue: updateData,
  });

  // Fetch and return updated action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionResult = await (db as any)
    .select({
      id: actionsTable.id,
      capaId: actionsTable.capaId,
      actionNumber: actionsTable.actionNumber,
      description: actionsTable.description,
      actionType: actionsTable.actionType,
      assigneeId: actionsTable.assigneeId,
      assigneeName: users.name,
      dueDate: actionsTable.dueDate,
      status: actionsTable.status,
      completionNotes: actionsTable.completionNotes,
      completedAt: actionsTable.completedAt,
      verifiedBy: actionsTable.verifiedBy,
      verifiedAt: actionsTable.verifiedAt,
    })
    .from(actionsTable)
    .leftJoin(users, eq(actionsTable.assigneeId, users.id))
    .where(eq(actionsTable.id, actionId))
    .limit(1);

  const action = actionResult[0] as DbCapaActionRow;
  return {
    ...action,
    actionType: action.actionType as CapaActionType,
    status: action.status as CapaActionStatus,
    assigneeName: action.assigneeName || undefined,
  } as CapaAction;
}

/**
 * Verify a completed action
 */
export async function verifyAction(
  actionId: number,
  userId: number
): Promise<CapaAction> {
  const { capa: capaTable, actions: actionsTable, users } = getTables();
  const db = await getDb();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any)
    .select()
    .from(actionsTable)
    .where(eq(actionsTable.id, actionId))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Action not found');
  }

  if (existing[0].status !== 'completed') {
    throw new Error('Can only verify completed actions');
  }

  const now = new Date().toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .update(actionsTable)
    .set({
      verifiedBy: userId,
      verifiedAt: now,
    })
    .where(eq(actionsTable.id, actionId));

  // Create audit log
  await createAuditLog({
    userId,
    action: 'APPROVE',
    tableName: 'capa_actions',
    recordId: actionId,
    newValue: { verifiedBy: userId, verifiedAt: now },
  });

  // Check if all actions are now verified - update CAPA status
  const capaId = existing[0].capaId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allActions = await (db as any)
    .select({ status: actionsTable.status, verifiedBy: actionsTable.verifiedBy })
    .from(actionsTable)
    .where(eq(actionsTable.capaId, capaId));

  const allVerified = allActions.every(
    (a: { status: string; verifiedBy: number | null }) =>
      a.status === 'completed' && a.verifiedBy !== null
  );

  if (allVerified) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(capaTable)
      .set({ status: 'verification', updatedAt: now })
      .where(eq(capaTable.id, capaId));
  }

  // Fetch and return updated action
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionResult = await (db as any)
    .select({
      id: actionsTable.id,
      capaId: actionsTable.capaId,
      actionNumber: actionsTable.actionNumber,
      description: actionsTable.description,
      actionType: actionsTable.actionType,
      assigneeId: actionsTable.assigneeId,
      assigneeName: users.name,
      dueDate: actionsTable.dueDate,
      status: actionsTable.status,
      completionNotes: actionsTable.completionNotes,
      completedAt: actionsTable.completedAt,
      verifiedBy: actionsTable.verifiedBy,
      verifiedAt: actionsTable.verifiedAt,
    })
    .from(actionsTable)
    .leftJoin(users, eq(actionsTable.assigneeId, users.id))
    .where(eq(actionsTable.id, actionId))
    .limit(1);

  const action = actionResult[0] as DbCapaActionRow;

  // Get verifier name
  let verifiedByName: string | undefined;
  if (action.verifiedBy) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const verifier = await (db as any)
      .select({ displayName: users.name })
      .from(users)
      .where(eq(users.id, action.verifiedBy))
      .limit(1);
    verifiedByName = verifier[0]?.displayName || undefined;
  }

  return {
    ...action,
    actionType: action.actionType as CapaActionType,
    status: action.status as CapaActionStatus,
    assigneeName: action.assigneeName || undefined,
    verifiedByName,
  } as CapaAction;
}

// ============================================
// CAPA Effectiveness
// ============================================

/**
 * Record effectiveness check
 */
export async function recordEffectiveness(
  capaId: number,
  data: CapaEffectivenessCreate,
  userId: number
): Promise<CapaEffectiveness> {
  const { effectiveness, users } = getTables();
  const db = await getDb();

  // Verify CAPA exists
  const capa = await getCapaById(capaId);
  if (!capa) {
    throw new Error('CAPA not found');
  }

  // Get next check number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checks = await (db as any)
    .select({ checkNumber: effectiveness.checkNumber })
    .from(effectiveness)
    .where(eq(effectiveness.capaId, capaId))
    .orderBy(desc(effectiveness.checkNumber))
    .limit(1);

  const nextCheckNumber = checks.length > 0 ? checks[0].checkNumber + 1 : 1;
  const now = new Date().toISOString();

  let checkId: number;

  if (isSqlite()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(effectiveness)
      .values({
        capaId,
        checkNumber: nextCheckNumber,
        checkDate: data.checkDate || now.split('T')[0],
        verifierId: userId,
        criteria: data.criteria,
        result: data.result,
        evidence: data.evidence || null,
        followUpRequired: data.followUpRequired || false,
        notes: data.notes || null,
        createdAt: now,
      })
      .returning({ id: effectiveness.id });
    checkId = result[0].id;
  } else {
    // MySQL - insert and get by capaId and checkNumber
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .insert(effectiveness)
      .values({
        capaId,
        checkNumber: nextCheckNumber,
        checkDate: data.checkDate || now.split('T')[0],
        verifierId: userId,
        criteria: data.criteria,
        result: data.result,
        evidence: data.evidence || null,
        followUpRequired: data.followUpRequired || false,
        notes: data.notes || null,
        createdAt: now,
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .select({ id: effectiveness.id })
      .from(effectiveness)
      .where(and(eq(effectiveness.capaId, capaId), eq(effectiveness.checkNumber, nextCheckNumber)))
      .limit(1);
    checkId = inserted[0].id;
  }

  // Create audit log
  await createAuditLog({
    userId,
    action: 'UPDATE',
    tableName: 'capa_effectiveness',
    recordId: checkId,
    newValue: { capaId, checkNumber: nextCheckNumber, result: data.result },
  });

  // Fetch and return the effectiveness check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const checkResult = await (db as any)
    .select({
      id: effectiveness.id,
      capaId: effectiveness.capaId,
      checkNumber: effectiveness.checkNumber,
      checkDate: effectiveness.checkDate,
      verifierId: effectiveness.verifierId,
      verifierName: users.name,
      criteria: effectiveness.criteria,
      result: effectiveness.result,
      evidence: effectiveness.evidence,
      followUpRequired: effectiveness.followUpRequired,
      notes: effectiveness.notes,
    })
    .from(effectiveness)
    .leftJoin(users, eq(effectiveness.verifierId, users.id))
    .where(eq(effectiveness.id, checkId))
    .limit(1);

  const check = checkResult[0] as DbCapaEffectivenessRow;
  return {
    ...check,
    checkDate: check.checkDate || '',
    verifierId: check.verifierId || userId,
    verifierName: check.verifierName || undefined,
    criteria: check.criteria || '',
    result: (check.result || data.result) as CapaEffectivenessResult,
    followUpRequired: check.followUpRequired || false,
  } as CapaEffectiveness;
}

// ============================================
// Dashboard & Statistics
// ============================================

/**
 * Get CAPA dashboard statistics
 */
export async function getCapaDashboard(): Promise<CapaDashboard> {
  const { capa: capaTable, effectiveness } = getTables();
  const db = await getDb();

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  // Get all CAPAs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allCapas = await (db as any)
    .select({
      status: capaTable.status,
      priority: capaTable.priority,
      dueDate: capaTable.dueDate,
      closedDate: capaTable.closedDate,
      createdAt: capaTable.createdAt,
    })
    .from(capaTable);

  // Calculate statistics
  const openStatuses = ['open', 'investigation', 'action_pending', 'verification'];
  const totalOpen = allCapas.filter((c: { status: string }) => openStatuses.includes(c.status)).length;

  const byStatus: Record<CapaStatus, number> = {
    open: 0,
    investigation: 0,
    action_pending: 0,
    verification: 0,
    closed: 0,
    cancelled: 0,
  };

  const byPriority: Record<CapaPriority, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  let overdue = 0;
  let closedThisMonth = 0;
  let totalClosureTime = 0;
  let closedCount = 0;

  allCapas.forEach((capa: { status: string; priority: string; dueDate: string | null; closedDate: string | null; createdAt: string }) => {
    byStatus[capa.status as CapaStatus]++;
    byPriority[capa.priority as CapaPriority]++;

    // Check overdue
    if (
      capa.dueDate &&
      capa.dueDate < today &&
      openStatuses.includes(capa.status)
    ) {
      overdue++;
    }

    // Closed this month
    if (capa.closedDate && capa.closedDate >= monthStartStr) {
      closedThisMonth++;
    }

    // Calculate closure time
    if (capa.closedDate) {
      const created = new Date(capa.createdAt);
      const closed = new Date(capa.closedDate);
      const days = Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      totalClosureTime += days;
      closedCount++;
    }
  });

  const avgClosureTime = closedCount > 0 ? Math.round(totalClosureTime / closedCount) : 0;

  // Calculate effectiveness rate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const effectivenessChecks = await (db as any)
    .select({ result: effectiveness.result })
    .from(effectiveness);

  const totalChecks = effectivenessChecks.length;
  const effectiveChecks = effectivenessChecks.filter(
    (c: { result: string | null }) => c.result === 'effective'
  ).length;
  const effectivenessRate = totalChecks > 0 ? Math.round((effectiveChecks / totalChecks) * 100) : 0;

  return {
    totalOpen,
    byStatus,
    byPriority,
    overdue,
    closedThisMonth,
    avgClosureTime,
    effectivenessRate,
  };
}
