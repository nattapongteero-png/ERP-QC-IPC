/**
 * Line Clearance Service
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T067)
 *
 * Implements line clearance workflow with dual sign-off:
 * - FR-062: Line Clearance Enforcement before production start
 * - FR-071-074: Electronic Signatures for both performer and verifier
 *
 * Workflow:
 * 1. Create line clearance checklist for work order
 * 2. Performer completes checklist items with e-signature
 * 3. Verifier reviews and approves with e-signature
 * 4. Work order can proceed to in_progress only after verification
 */

import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { eq, and } from 'drizzle-orm';
import { createElectronicSignature, getSignaturesForEntity, type SignatureResult } from './electronic-signature-service';

// Types
export interface LineClearanceChecklist {
  id: number;
  workOrderId: number;
  previousProductCleared: boolean;
  areaClean: boolean;
  equipmentClean: boolean;
  noContaminationRisk: boolean;
  labelsRemoved: boolean;
  docsReady: boolean;
  performedBy: number | null;
  performedAt: string | Date | null;
  performedSignatureId: number | null;
  verifiedBy: number | null;
  verifiedAt: string | Date | null;
  verifiedSignatureId: number | null;
  status: 'pending' | 'performed' | 'verified' | 'rejected';
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChecklistItemsInput {
  previousProductCleared: boolean;
  areaClean: boolean;
  equipmentClean: boolean;
  noContaminationRisk: boolean;
  labelsRemoved: boolean;
  docsReady: boolean;
  notes?: string;
}

export interface PerformLineClearanceInput {
  workOrderId: number;
  /** Per-phase clearance. 'pre_production' | 'production' | 'post_production' | 'packaging'. Defaults to 'production' for legacy callers. */
  phase?: string;
  userId: number;
  password: string;
  checklistItems: ChecklistItemsInput;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyLineClearanceInput {
  checklistId: number;
  userId: number;
  password: string;
  approved: boolean;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LineClearanceResult {
  success: boolean;
  checklistId?: number;
  error?: string;
  checklist?: LineClearanceChecklist;
}

export interface LineClearanceStatus {
  required: boolean;
  status: 'not_started' | 'pending' | 'performed' | 'verified' | 'rejected';
  checklist?: LineClearanceChecklist;
  canStartProduction: boolean;
  message: string;
}

/**
 * Check if line clearance is required for a work order
 */
export async function checkLineClearanceRequired(workOrderId: number, phase: string = 'production'): Promise<LineClearanceStatus> {
  const workOrdersTable = getTableRef('workOrders');
  const checklistTable = getTableRef('lineClearanceChecklists');

  // Get work order details
  const workOrders = await executeDbOperation(async (db) => {
    return db
      .select({
        id: workOrdersTable.id,
        status: workOrdersTable.status,
        lineClearanceRequired: workOrdersTable.lineClearanceRequired,
        lineClearanceStatus: workOrdersTable.lineClearanceStatus,
      })
      .from(workOrdersTable)
      .where(eq(workOrdersTable.id, workOrderId))
      .limit(1);
  });

  if (workOrders.length === 0) {
    return {
      required: false,
      status: 'not_started',
      canStartProduction: false,
      message: 'Work order not found',
    };
  }

  const workOrder = workOrders[0];

  // If line clearance not required, allow production
  if (!workOrder.lineClearanceRequired) {
    return {
      required: false,
      status: 'verified',
      canStartProduction: true,
      message: 'Line clearance not required for this work order',
    };
  }

  // Get existing checklist if any — scoped by phase
  const checklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(and(eq(checklistTable.workOrderId, workOrderId), eq(checklistTable.phase, phase)))
      .limit(1);
  });

  if (checklists.length === 0) {
    return {
      required: true,
      status: 'not_started',
      canStartProduction: false,
      message: 'Line clearance required but not started',
    };
  }

  const checklist = checklists[0] as LineClearanceChecklist;

  if (checklist.status === 'verified') {
    return {
      required: true,
      status: 'verified',
      checklist,
      canStartProduction: true,
      message: 'Line clearance verified - production can start',
    };
  }

  if (checklist.status === 'rejected') {
    return {
      required: true,
      status: 'rejected',
      checklist,
      canStartProduction: false,
      message: 'Line clearance was rejected - requires new clearance',
    };
  }

  if (checklist.status === 'performed') {
    return {
      required: true,
      status: 'performed',
      checklist,
      canStartProduction: false,
      message: 'Line clearance performed - awaiting verification',
    };
  }

  return {
    required: true,
    status: 'pending',
    checklist,
    canStartProduction: false,
    message: 'Line clearance in progress',
  };
}

/**
 * Create or update a line clearance checklist with performer e-signature
 */
export async function performLineClearance(
  input: PerformLineClearanceInput
): Promise<LineClearanceResult> {
  const checklistTable = getTableRef('lineClearanceChecklists');
  const workOrdersTable = getTableRef('workOrders');

  // Validate all checklist items are true
  const allItemsChecked =
    input.checklistItems.previousProductCleared &&
    input.checklistItems.areaClean &&
    input.checklistItems.equipmentClean &&
    input.checklistItems.noContaminationRisk &&
    input.checklistItems.labelsRemoved &&
    input.checklistItems.docsReady;

  if (!allItemsChecked) {
    return {
      success: false,
      error: 'All checklist items must be verified before signing',
    };
  }

  const inputPhase = input.phase || 'production';

  // Check if checklist already exists for this phase
  const existingChecklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(and(eq(checklistTable.workOrderId, input.workOrderId), eq(checklistTable.phase, inputPhase)))
      .limit(1);
  });

  let checklistId: number;

  if (existingChecklists.length > 0) {
    const existing = existingChecklists[0] as LineClearanceChecklist;

    // Cannot re-perform if already verified
    if (existing.status === 'verified') {
      return {
        success: false,
        error: 'Line clearance already verified',
      };
    }

    checklistId = existing.id;
  } else {
    // Create new checklist for this phase
    const result = await executeDbOperation(async (db) => {
      return db.insert(checklistTable).values({
        workOrderId: input.workOrderId,
        phase: inputPhase,
        previousProductCleared: input.checklistItems.previousProductCleared,
        areaClean: input.checklistItems.areaClean,
        equipmentClean: input.checklistItems.equipmentClean,
        noContaminationRisk: input.checklistItems.noContaminationRisk,
        labelsRemoved: input.checklistItems.labelsRemoved,
        docsReady: input.checklistItems.docsReady,
        notes: input.checklistItems.notes || null,
        status: 'pending',
        createdAt: getNow(),
        updatedAt: getNow(),
      });
    });
    checklistId = getInsertId(result);
  }

  // Create electronic signature for performer
  const signatureResult: SignatureResult = await createElectronicSignature({
    entityType: 'line_clearance',
    entityId: checklistId,
    action: 'perform',
    userId: input.userId,
    password: input.password,
    meaning: 'I confirm that I have personally verified all line clearance checklist items and the production area is ready for operation.',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return {
      success: false,
      error: signatureResult.error || 'Failed to create electronic signature',
    };
  }

  // Update checklist with performer info
  await executeDbOperation(async (db) => {
    return db
      .update(checklistTable)
      .set({
        previousProductCleared: input.checklistItems.previousProductCleared,
        areaClean: input.checklistItems.areaClean,
        equipmentClean: input.checklistItems.equipmentClean,
        noContaminationRisk: input.checklistItems.noContaminationRisk,
        labelsRemoved: input.checklistItems.labelsRemoved,
        docsReady: input.checklistItems.docsReady,
        notes: input.checklistItems.notes || null,
        performedBy: input.userId,
        performedAt: getNow(),
        performedSignatureId: signatureResult.signatureId,
        status: 'performed',
        updatedAt: getNow(),
      })
      .where(eq(checklistTable.id, checklistId));
  });

  // Update work order line clearance status
  await executeDbOperation(async (db) => {
    return db
      .update(workOrdersTable)
      .set({
        lineClearanceStatus: 'performed',
        lineClearanceChecklistId: checklistId,
        updatedAt: getNow(),
      })
      .where(eq(workOrdersTable.id, input.workOrderId));
  });

  // Get updated checklist
  const updatedChecklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(eq(checklistTable.id, checklistId))
      .limit(1);
  });

  return {
    success: true,
    checklistId,
    checklist: updatedChecklists[0] as LineClearanceChecklist,
  };
}

/**
 * Verify (approve or reject) a line clearance with verifier e-signature
 */
export async function verifyLineClearance(
  input: VerifyLineClearanceInput
): Promise<LineClearanceResult> {
  const checklistTable = getTableRef('lineClearanceChecklists');
  const workOrdersTable = getTableRef('workOrders');

  // Get existing checklist
  const checklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(eq(checklistTable.id, input.checklistId))
      .limit(1);
  });

  if (checklists.length === 0) {
    return {
      success: false,
      error: 'Line clearance checklist not found',
    };
  }

  const checklist = checklists[0] as LineClearanceChecklist;

  // Must be performed before verification
  if (checklist.status !== 'performed') {
    return {
      success: false,
      error: `Cannot verify checklist in status: ${checklist.status}. Must be 'performed' first.`,
    };
  }

  // Verifier must be different from performer
  if (checklist.performedBy === input.userId) {
    return {
      success: false,
      error: 'Verifier must be a different person from the performer (dual verification required)',
    };
  }

  // Create electronic signature for verifier
  const action = input.approved ? 'verify_approve' : 'verify_reject';
  const meaning = input.approved
    ? 'I confirm that I have reviewed and verified the line clearance checklist and approve production to proceed.'
    : `I have reviewed the line clearance checklist and reject it for the following reason: ${input.notes || 'Not specified'}`;

  const signatureResult: SignatureResult = await createElectronicSignature({
    entityType: 'line_clearance',
    entityId: input.checklistId,
    action,
    userId: input.userId,
    password: input.password,
    meaning,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return {
      success: false,
      error: signatureResult.error || 'Failed to create electronic signature',
    };
  }

  const newStatus = input.approved ? 'verified' : 'rejected';
  const notes = input.notes
    ? (checklist.notes ? `${checklist.notes}\n[Verifier]: ${input.notes}` : `[Verifier]: ${input.notes}`)
    : checklist.notes;

  // Update checklist with verifier info
  await executeDbOperation(async (db) => {
    return db
      .update(checklistTable)
      .set({
        verifiedBy: input.userId,
        verifiedAt: getNow(),
        verifiedSignatureId: signatureResult.signatureId,
        status: newStatus,
        notes,
        updatedAt: getNow(),
      })
      .where(eq(checklistTable.id, input.checklistId));
  });

  // Update work order line clearance status
  const woStatus = input.approved ? 'cleared' : 'failed';
  await executeDbOperation(async (db) => {
    return db
      .update(workOrdersTable)
      .set({
        lineClearanceStatus: woStatus,
        lineClearanceBy: input.approved ? input.userId : null,
        lineClearanceAt: input.approved ? getNow() : null,
        updatedAt: getNow(),
      })
      .where(eq(workOrdersTable.id, checklist.workOrderId));
  });

  // Get updated checklist
  const updatedChecklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(eq(checklistTable.id, input.checklistId))
      .limit(1);
  });

  return {
    success: true,
    checklistId: input.checklistId,
    checklist: updatedChecklists[0] as LineClearanceChecklist,
  };
}

/**
 * Get line clearance details for a work order
 */
export async function getLineClearanceForWorkOrder(
  workOrderId: number,
  phase: string = 'production'
): Promise<LineClearanceChecklist | null> {
  const checklistTable = getTableRef('lineClearanceChecklists');

  const checklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(and(eq(checklistTable.workOrderId, workOrderId), eq(checklistTable.phase, phase)))
      .limit(1);
  });

  return checklists.length > 0 ? (checklists[0] as LineClearanceChecklist) : null;
}

/**
 * Get line clearance with user details and signatures
 */
export async function getLineClearanceDetails(checklistId: number): Promise<{
  checklist: LineClearanceChecklist | null;
  performerName?: string;
  verifierName?: string;
  signatures: Awaited<ReturnType<typeof getSignaturesForEntity>>;
}> {
  const checklistTable = getTableRef('lineClearanceChecklists');
  const usersTable = getTableRef('users');

  const checklists = await executeDbOperation(async (db) => {
    return db
      .select()
      .from(checklistTable)
      .where(eq(checklistTable.id, checklistId))
      .limit(1);
  });

  if (checklists.length === 0) {
    return { checklist: null, signatures: [] };
  }

  const checklist = checklists[0] as LineClearanceChecklist;

  // Get performer name if exists
  let performerName: string | undefined;
  if (checklist.performedBy) {
    const performers = await executeDbOperation(async (db) => {
      return db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, checklist.performedBy as number))
        .limit(1);
    });
    performerName = performers[0]?.name;
  }

  // Get verifier name if exists
  let verifierName: string | undefined;
  if (checklist.verifiedBy) {
    const verifiers = await executeDbOperation(async (db) => {
      return db
        .select({ name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, checklist.verifiedBy as number))
        .limit(1);
    });
    verifierName = verifiers[0]?.name;
  }

  // Get electronic signatures
  const signatures = await getSignaturesForEntity('line_clearance', checklistId);

  return {
    checklist,
    performerName,
    verifierName,
    signatures,
  };
}

/**
 * Check if work order can start production (line clearance gate)
 */
export async function canStartProduction(workOrderId: number): Promise<{
  allowed: boolean;
  reason: string;
  lineClearanceStatus: LineClearanceStatus;
}> {
  const lineClearanceStatus = await checkLineClearanceRequired(workOrderId);

  if (!lineClearanceStatus.canStartProduction) {
    return {
      allowed: false,
      reason: lineClearanceStatus.message,
      lineClearanceStatus,
    };
  }

  return {
    allowed: true,
    reason: 'All pre-production checks passed',
    lineClearanceStatus,
  };
}
