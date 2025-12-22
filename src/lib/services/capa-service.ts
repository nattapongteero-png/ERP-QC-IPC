/**
 * CAPA Service
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * Manages Corrective and Preventive Actions (CAPA) with action tracking,
 * effectiveness verification, and audit trail.
 */

import { getDb, useSqlite } from '../db';
import { eq, and, desc, asc, gte, lte, like, or, isNull, sql, count } from 'drizzle-orm';
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
  if (useSqlite()) {
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
  const result = await (await getDb())
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

  if (useSqlite()) {
    // Build query conditions
    const conditions = [];
    if (status) conditions.push(eq(sqliteCapa.status, status));
    if (type) conditions.push(eq(sqliteCapa.type, type));
    if (priority) conditions.push(eq(sqliteCapa.priority, priority));
    if (sourceType) conditions.push(eq(sqliteCapa.sourceType, sourceType));
    if (ownerId) conditions.push(eq(sqliteCapa.ownerId, ownerId));

    const today = new Date().toISOString().split('T')[0];
    if (overdue) {
      conditions.push(
        and(
          lte(sqliteCapa.dueDate, today),
          or(
            eq(sqliteCapa.status, 'open'),
            eq(sqliteCapa.status, 'investigation'),
            eq(sqliteCapa.status, 'action_pending'),
            eq(sqliteCapa.status, 'verification')
          )
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const countResult = await (await getDb())
      .select({ count: count() })
      .from(sqliteCapa)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get CAPAs with user info
    const capas = await (await getDb())
      .select({
        id: sqliteCapa.id,
        capaNumber: sqliteCapa.capaNumber,
        title: sqliteCapa.title,
        sourceType: sqliteCapa.sourceType,
        sourceId: sqliteCapa.sourceId,
        deviationId: sqliteCapa.deviationId,
        complaintId: sqliteCapa.complaintId,
        auditFindingId: sqliteCapa.auditFindingId,
        type: sqliteCapa.type,
        priority: sqliteCapa.priority,
        status: sqliteCapa.status,
        rootCauseAnalysis: sqliteCapa.rootCauseAnalysis,
        rootCauseCategory: sqliteCapa.rootCauseCategory,
        dueDate: sqliteCapa.dueDate,
        closedDate: sqliteCapa.closedDate,
        ownerId: sqliteCapa.ownerId,
        ownerName: sqliteUsers.name,
        createdBy: sqliteCapa.createdBy,
        createdAt: sqliteCapa.createdAt,
        updatedAt: sqliteCapa.updatedAt,
      })
      .from(sqliteCapa)
      .leftJoin(sqliteUsers, eq(sqliteCapa.ownerId, sqliteUsers.id))
      .where(whereClause)
      .orderBy(desc(sqliteCapa.createdAt))
      .limit(limit)
      .offset(offset);

    // Add action counts and overdue status
    const capaList: Capa[] = await Promise.all(
      capas.map(async (capa: DbCapaRow) => {
        const actions = await (await getDb())
          .select({ status: sqliteCapaActions.status })
          .from(sqliteCapaActions)
          .where(eq(sqliteCapaActions.capaId, capa.id));

        const actionCount = actions.length;
        const actionsCompleted = actions.filter((a: { status: string }) => a.status === 'completed').length;
        const isOverdue = capa.dueDate && capa.dueDate < today &&
          !['closed', 'cancelled'].includes(capa.status);

        return {
          ...capa,
          sourceType: capa.sourceType as CapaSourceType,
          type: capa.type as CapaType,
          priority: capa.priority as CapaPriority,
          status: capa.status as CapaStatus,
          actionCount,
          actionsCompleted,
          isOverdue,
        } as Capa;
      })
    );

    return { capas: capaList, total };
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Get CAPA by ID with basic info
 */
export async function getCapaById(id: number): Promise<Capa | null> {
  if (useSqlite()) {
    const result = await (await getDb())
      .select({
        id: sqliteCapa.id,
        capaNumber: sqliteCapa.capaNumber,
        title: sqliteCapa.title,
        sourceType: sqliteCapa.sourceType,
        sourceId: sqliteCapa.sourceId,
        deviationId: sqliteCapa.deviationId,
        complaintId: sqliteCapa.complaintId,
        auditFindingId: sqliteCapa.auditFindingId,
        type: sqliteCapa.type,
        priority: sqliteCapa.priority,
        status: sqliteCapa.status,
        rootCauseAnalysis: sqliteCapa.rootCauseAnalysis,
        rootCauseCategory: sqliteCapa.rootCauseCategory,
        dueDate: sqliteCapa.dueDate,
        closedDate: sqliteCapa.closedDate,
        ownerId: sqliteCapa.ownerId,
        ownerName: sqliteUsers.name,
        createdBy: sqliteCapa.createdBy,
        createdAt: sqliteCapa.createdAt,
        updatedAt: sqliteCapa.updatedAt,
      })
      .from(sqliteCapa)
      .leftJoin(sqliteUsers, eq(sqliteCapa.ownerId, sqliteUsers.id))
      .where(eq(sqliteCapa.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const capa = result[0] as DbCapaRow;
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = capa.dueDate && capa.dueDate < today &&
      !['closed', 'cancelled'].includes(capa.status);

    return {
      ...capa,
      sourceType: capa.sourceType as CapaSourceType,
      type: capa.type as CapaType,
      priority: capa.priority as CapaPriority,
      status: capa.status as CapaStatus,
      isOverdue,
    } as Capa;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Get CAPA with full details including actions and effectiveness checks
 */
export async function getCapaDetails(id: number): Promise<CapaDetails | null> {
  const capa = await getCapaById(id);
  if (!capa) return null;

  if (useSqlite()) {
    // Get actions
    const actionsResult = await (await getDb())
      .select({
        id: sqliteCapaActions.id,
        capaId: sqliteCapaActions.capaId,
        actionNumber: sqliteCapaActions.actionNumber,
        description: sqliteCapaActions.description,
        actionType: sqliteCapaActions.actionType,
        assigneeId: sqliteCapaActions.assigneeId,
        assigneeName: sqliteUsers.displayName,
        dueDate: sqliteCapaActions.dueDate,
        status: sqliteCapaActions.status,
        completionNotes: sqliteCapaActions.completionNotes,
        completedAt: sqliteCapaActions.completedAt,
        verifiedBy: sqliteCapaActions.verifiedBy,
        verifiedAt: sqliteCapaActions.verifiedAt,
      })
      .from(sqliteCapaActions)
      .leftJoin(sqliteUsers, eq(sqliteCapaActions.assigneeId, sqliteUsers.id))
      .where(eq(sqliteCapaActions.capaId, id))
      .orderBy(asc(sqliteCapaActions.actionNumber));

    // Get verifier names for actions
    const actions: CapaAction[] = await Promise.all(
      actionsResult.map(async (action: DbCapaActionRow) => {
        let verifiedByName: string | undefined;
        if (action.verifiedBy) {
          const verifier = await (await getDb())
            .select({ displayName: sqliteUsers.displayName })
            .from(sqliteUsers)
            .where(eq(sqliteUsers.id, action.verifiedBy))
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
    const effectivenessResult = await (await getDb())
      .select({
        id: sqliteCapaEffectiveness.id,
        capaId: sqliteCapaEffectiveness.capaId,
        checkNumber: sqliteCapaEffectiveness.checkNumber,
        checkDate: sqliteCapaEffectiveness.checkDate,
        verifierId: sqliteCapaEffectiveness.verifierId,
        verifierName: sqliteUsers.displayName,
        criteria: sqliteCapaEffectiveness.criteria,
        result: sqliteCapaEffectiveness.result,
        evidence: sqliteCapaEffectiveness.evidence,
        followUpRequired: sqliteCapaEffectiveness.followUpRequired,
        notes: sqliteCapaEffectiveness.notes,
      })
      .from(sqliteCapaEffectiveness)
      .leftJoin(sqliteUsers, eq(sqliteCapaEffectiveness.verifierId, sqliteUsers.id))
      .where(eq(sqliteCapaEffectiveness.capaId, id))
      .orderBy(asc(sqliteCapaEffectiveness.checkNumber));

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
    if (capa.deviationId) {
      const deviation = await (await getDb())
        .select()
        .from(sqliteDeviations)
        .where(eq(sqliteDeviations.id, capa.deviationId))
        .limit(1);
      if (deviation.length > 0) {
        source = deviation[0];
      }
    }

    return {
      ...capa,
      actions,
      effectivenessChecks,
      source,
    };
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Create a new CAPA
 */
export async function createCapa(
  data: CapaCreate,
  userId: number
): Promise<Capa> {
  if (useSqlite()) {
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

    const result = await (await getDb())
      .insert(sqliteCapa)
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
      .returning({ id: sqliteCapa.id });

    const capaId = result[0].id;

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_created',
      tableName: 'capa',
      recordId: capaId,
      newValues: { capaNumber, title: data.title },
    });

    const capa = await getCapaById(capaId);
    return capa!;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Create CAPA from a deviation
 */
export async function createFromDeviation(
  deviationId: number,
  capaData: Omit<CapaCreate, 'sourceType' | 'sourceId'>,
  userId: number
): Promise<Capa> {
  if (useSqlite()) {
    // Verify deviation exists
    const deviation = await (await getDb())
      .select()
      .from(sqliteDeviations)
      .where(eq(sqliteDeviations.id, deviationId))
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
      action: 'capa_linked_to_deviation',
      tableName: 'capa',
      recordId: capa.id,
      newValues: { deviationId, deviationNumber: deviation[0].deviationNumber },
    });

    return capa;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Update CAPA
 */
export async function updateCapa(
  id: number,
  data: CapaUpdate,
  userId: number
): Promise<Capa> {
  if (useSqlite()) {
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

    await (await getDb())
      .update(sqliteCapa)
      .set(updateData)
      .where(eq(sqliteCapa.id, id));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_updated',
      tableName: 'capa',
      recordId: id,
      oldValues: { status: existing.status, priority: existing.priority },
      newValues: updateData,
    });

    const updated = await getCapaById(id);
    return updated!;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Close CAPA
 */
export async function closeCapa(
  id: number,
  closureNotes: string | null,
  userId: number
): Promise<Capa> {
  if (useSqlite()) {
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

    await (await getDb())
      .update(sqliteCapa)
      .set({
        status: 'closed',
        closedDate: now,
        updatedAt: now,
      })
      .where(eq(sqliteCapa.id, id));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_closed',
      tableName: 'capa',
      recordId: id,
      newValues: { closedDate: now, closureNotes },
    });

    const closed = await getCapaById(id);
    return closed!;
  }

  throw new Error('MySQL not implemented for CAPA');
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
  if (useSqlite()) {
    // Verify CAPA exists
    const capa = await getCapaById(capaId);
    if (!capa) {
      throw new Error('CAPA not found');
    }

    // Get next action number
    const actions = await (await getDb())
      .select({ actionNumber: sqliteCapaActions.actionNumber })
      .from(sqliteCapaActions)
      .where(eq(sqliteCapaActions.capaId, capaId))
      .orderBy(desc(sqliteCapaActions.actionNumber))
      .limit(1);

    const nextActionNumber = actions.length > 0 ? actions[0].actionNumber + 1 : 1;
    const now = new Date().toISOString();

    const result = await (await getDb())
      .insert(sqliteCapaActions)
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
      .returning({ id: sqliteCapaActions.id });

    const actionId = result[0].id;

    // Update CAPA status to action_pending if still in investigation
    if (['open', 'investigation'].includes(capa.status)) {
      await (await getDb())
        .update(sqliteCapa)
        .set({ status: 'action_pending', updatedAt: now })
        .where(eq(sqliteCapa.id, capaId));
    }

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_action_added',
      tableName: 'capa_actions',
      recordId: actionId,
      newValues: { capaId, actionNumber: nextActionNumber, description: data.description },
    });

    // Fetch and return the action with assignee name
    const actionResult = await (await getDb())
      .select({
        id: sqliteCapaActions.id,
        capaId: sqliteCapaActions.capaId,
        actionNumber: sqliteCapaActions.actionNumber,
        description: sqliteCapaActions.description,
        actionType: sqliteCapaActions.actionType,
        assigneeId: sqliteCapaActions.assigneeId,
        assigneeName: sqliteUsers.displayName,
        dueDate: sqliteCapaActions.dueDate,
        status: sqliteCapaActions.status,
        completionNotes: sqliteCapaActions.completionNotes,
        completedAt: sqliteCapaActions.completedAt,
        verifiedBy: sqliteCapaActions.verifiedBy,
        verifiedAt: sqliteCapaActions.verifiedAt,
      })
      .from(sqliteCapaActions)
      .leftJoin(sqliteUsers, eq(sqliteCapaActions.assigneeId, sqliteUsers.id))
      .where(eq(sqliteCapaActions.id, actionId))
      .limit(1);

    const action = actionResult[0] as DbCapaActionRow;
    return {
      ...action,
      actionType: action.actionType as CapaActionType,
      status: action.status as CapaActionStatus,
      assigneeName: action.assigneeName || undefined,
    } as CapaAction;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Update action status and notes
 */
export async function updateAction(
  actionId: number,
  data: CapaActionUpdate,
  userId: number
): Promise<CapaAction> {
  if (useSqlite()) {
    // Get existing action
    const existing = await (await getDb())
      .select()
      .from(sqliteCapaActions)
      .where(eq(sqliteCapaActions.id, actionId))
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

    await (await getDb())
      .update(sqliteCapaActions)
      .set(updateData)
      .where(eq(sqliteCapaActions.id, actionId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_action_updated',
      tableName: 'capa_actions',
      recordId: actionId,
      oldValues: { status: existing[0].status },
      newValues: updateData,
    });

    // Fetch and return updated action
    const actionResult = await (await getDb())
      .select({
        id: sqliteCapaActions.id,
        capaId: sqliteCapaActions.capaId,
        actionNumber: sqliteCapaActions.actionNumber,
        description: sqliteCapaActions.description,
        actionType: sqliteCapaActions.actionType,
        assigneeId: sqliteCapaActions.assigneeId,
        assigneeName: sqliteUsers.displayName,
        dueDate: sqliteCapaActions.dueDate,
        status: sqliteCapaActions.status,
        completionNotes: sqliteCapaActions.completionNotes,
        completedAt: sqliteCapaActions.completedAt,
        verifiedBy: sqliteCapaActions.verifiedBy,
        verifiedAt: sqliteCapaActions.verifiedAt,
      })
      .from(sqliteCapaActions)
      .leftJoin(sqliteUsers, eq(sqliteCapaActions.assigneeId, sqliteUsers.id))
      .where(eq(sqliteCapaActions.id, actionId))
      .limit(1);

    const action = actionResult[0] as DbCapaActionRow;
    return {
      ...action,
      actionType: action.actionType as CapaActionType,
      status: action.status as CapaActionStatus,
      assigneeName: action.assigneeName || undefined,
    } as CapaAction;
  }

  throw new Error('MySQL not implemented for CAPA');
}

/**
 * Verify a completed action
 */
export async function verifyAction(
  actionId: number,
  userId: number
): Promise<CapaAction> {
  if (useSqlite()) {
    const existing = await (await getDb())
      .select()
      .from(sqliteCapaActions)
      .where(eq(sqliteCapaActions.id, actionId))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('Action not found');
    }

    if (existing[0].status !== 'completed') {
      throw new Error('Can only verify completed actions');
    }

    const now = new Date().toISOString();

    await (await getDb())
      .update(sqliteCapaActions)
      .set({
        verifiedBy: userId,
        verifiedAt: now,
      })
      .where(eq(sqliteCapaActions.id, actionId));

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_action_verified',
      tableName: 'capa_actions',
      recordId: actionId,
      newValues: { verifiedBy: userId, verifiedAt: now },
    });

    // Check if all actions are now verified - update CAPA status
    const capaId = existing[0].capaId;
    const allActions = await (await getDb())
      .select({ status: sqliteCapaActions.status, verifiedBy: sqliteCapaActions.verifiedBy })
      .from(sqliteCapaActions)
      .where(eq(sqliteCapaActions.capaId, capaId));

    const allVerified = allActions.every(
      (a: { status: string; verifiedBy: number | null }) =>
        a.status === 'completed' && a.verifiedBy !== null
    );

    if (allVerified) {
      await (await getDb())
        .update(sqliteCapa)
        .set({ status: 'verification', updatedAt: now })
        .where(eq(sqliteCapa.id, capaId));
    }

    // Fetch and return updated action
    const actionResult = await (await getDb())
      .select({
        id: sqliteCapaActions.id,
        capaId: sqliteCapaActions.capaId,
        actionNumber: sqliteCapaActions.actionNumber,
        description: sqliteCapaActions.description,
        actionType: sqliteCapaActions.actionType,
        assigneeId: sqliteCapaActions.assigneeId,
        assigneeName: sqliteUsers.displayName,
        dueDate: sqliteCapaActions.dueDate,
        status: sqliteCapaActions.status,
        completionNotes: sqliteCapaActions.completionNotes,
        completedAt: sqliteCapaActions.completedAt,
        verifiedBy: sqliteCapaActions.verifiedBy,
        verifiedAt: sqliteCapaActions.verifiedAt,
      })
      .from(sqliteCapaActions)
      .leftJoin(sqliteUsers, eq(sqliteCapaActions.assigneeId, sqliteUsers.id))
      .where(eq(sqliteCapaActions.id, actionId))
      .limit(1);

    const action = actionResult[0] as DbCapaActionRow;

    // Get verifier name
    let verifiedByName: string | undefined;
    if (action.verifiedBy) {
      const verifier = await (await getDb())
        .select({ displayName: sqliteUsers.displayName })
        .from(sqliteUsers)
        .where(eq(sqliteUsers.id, action.verifiedBy))
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

  throw new Error('MySQL not implemented for CAPA');
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
  if (useSqlite()) {
    // Verify CAPA exists
    const capa = await getCapaById(capaId);
    if (!capa) {
      throw new Error('CAPA not found');
    }

    // Get next check number
    const checks = await (await getDb())
      .select({ checkNumber: sqliteCapaEffectiveness.checkNumber })
      .from(sqliteCapaEffectiveness)
      .where(eq(sqliteCapaEffectiveness.capaId, capaId))
      .orderBy(desc(sqliteCapaEffectiveness.checkNumber))
      .limit(1);

    const nextCheckNumber = checks.length > 0 ? checks[0].checkNumber + 1 : 1;
    const now = new Date().toISOString();

    const result = await (await getDb())
      .insert(sqliteCapaEffectiveness)
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
      .returning({ id: sqliteCapaEffectiveness.id });

    const checkId = result[0].id;

    // Create audit log
    await createAuditLog({
      userId,
      action: 'capa_effectiveness_recorded',
      tableName: 'capa_effectiveness',
      recordId: checkId,
      newValues: { capaId, checkNumber: nextCheckNumber, result: data.result },
    });

    // Fetch and return the effectiveness check
    const checkResult = await (await getDb())
      .select({
        id: sqliteCapaEffectiveness.id,
        capaId: sqliteCapaEffectiveness.capaId,
        checkNumber: sqliteCapaEffectiveness.checkNumber,
        checkDate: sqliteCapaEffectiveness.checkDate,
        verifierId: sqliteCapaEffectiveness.verifierId,
        verifierName: sqliteUsers.displayName,
        criteria: sqliteCapaEffectiveness.criteria,
        result: sqliteCapaEffectiveness.result,
        evidence: sqliteCapaEffectiveness.evidence,
        followUpRequired: sqliteCapaEffectiveness.followUpRequired,
        notes: sqliteCapaEffectiveness.notes,
      })
      .from(sqliteCapaEffectiveness)
      .leftJoin(sqliteUsers, eq(sqliteCapaEffectiveness.verifierId, sqliteUsers.id))
      .where(eq(sqliteCapaEffectiveness.id, checkId))
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

  throw new Error('MySQL not implemented for CAPA');
}

// ============================================
// Dashboard & Statistics
// ============================================

/**
 * Get CAPA dashboard statistics
 */
export async function getCapaDashboard(): Promise<CapaDashboard> {
  if (useSqlite()) {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Get all CAPAs
    const allCapas = await (await getDb())
      .select({
        status: sqliteCapa.status,
        priority: sqliteCapa.priority,
        dueDate: sqliteCapa.dueDate,
        closedDate: sqliteCapa.closedDate,
        createdAt: sqliteCapa.createdAt,
      })
      .from(sqliteCapa);

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
    const effectivenessChecks = await (await getDb())
      .select({ result: sqliteCapaEffectiveness.result })
      .from(sqliteCapaEffectiveness);

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

  throw new Error('MySQL not implemented for CAPA');
}
