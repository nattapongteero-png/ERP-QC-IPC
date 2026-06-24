/**
 * Gowning Verification Service (eBMR GMP)
 *
 * Per-batch attire/PPE checklist with dual sign-off, modeled on
 * line-clearance.service.ts. One checklist per Work Order.
 *
 * Workflow:
 *   1. Operator completes the 6 gowning items + e-signature  -> status 'performed'
 *   2. A different verifier reviews + e-signature             -> 'verified' | 'rejected'
 *
 * Unlike line clearance this does NOT gate the work-order status; it is a
 * record kept for the eBMR.
 */

import { getTableRef, getInsertId, executeDbOperation } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import { eq } from 'drizzle-orm';
import { createElectronicSignature, getSignaturesForEntity, type SignatureResult } from './electronic-signature-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GowningRecord {
  id: number;
  workOrderId: number;
  phase: string;
  gownClean: boolean;
  glovesOn: boolean;
  maskOn: boolean;
  hairnetOn: boolean;
  shoeCoverOn: boolean;
  handsSanitized: boolean;
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

export interface GowningChecklistItems {
  gownClean: boolean;
  glovesOn: boolean;
  maskOn: boolean;
  hairnetOn: boolean;
  shoeCoverOn: boolean;
  handsSanitized: boolean;
  notes?: string;
}

export interface PerformGowningInput {
  workOrderId: number;
  userId: number;
  password: string;
  checklistItems: GowningChecklistItems;
  ipAddress?: string;
  userAgent?: string;
}

export interface VerifyGowningInput {
  recordId: number;
  userId: number;
  password: string;
  approved: boolean;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GowningResult {
  success: boolean;
  recordId?: number;
  error?: string;
  record?: GowningRecord;
}

const GOWNING_PHASE = 'pre_production';

// ---------------------------------------------------------------------------
// Perform (operator) — create/update record + e-signature
// ---------------------------------------------------------------------------

export async function performGowning(input: PerformGowningInput): Promise<GowningResult> {
  const table = getTableRef('woGowningRecords');

  const allChecked =
    input.checklistItems.gownClean &&
    input.checklistItems.glovesOn &&
    input.checklistItems.maskOn &&
    input.checklistItems.hairnetOn &&
    input.checklistItems.shoeCoverOn &&
    input.checklistItems.handsSanitized;

  if (!allChecked) {
    return { success: false, error: 'All gowning checklist items must be verified before signing' };
  }

  // One record per WO — find or create
  const existing = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.workOrderId, input.workOrderId)).limit(1);
  });

  let recordId: number;
  if (existing.length > 0) {
    const row = existing[0] as GowningRecord;
    if (row.status === 'verified') {
      return { success: false, error: 'Gowning already verified' };
    }
    recordId = row.id;
  } else {
    const result = await executeDbOperation(async (db) => {
      return db.insert(table).values({
        workOrderId: input.workOrderId,
        phase: GOWNING_PHASE,
        gownClean: input.checklistItems.gownClean,
        glovesOn: input.checklistItems.glovesOn,
        maskOn: input.checklistItems.maskOn,
        hairnetOn: input.checklistItems.hairnetOn,
        shoeCoverOn: input.checklistItems.shoeCoverOn,
        handsSanitized: input.checklistItems.handsSanitized,
        notes: input.checklistItems.notes || null,
        status: 'pending',
        createdAt: getNow(),
        updatedAt: getNow(),
      });
    });
    recordId = getInsertId(result);
  }

  const signatureResult: SignatureResult = await createElectronicSignature({
    entityType: 'wo_gowning',
    entityId: recordId,
    action: 'perform',
    userId: input.userId,
    password: input.password,
    meaning: 'I confirm that I have personally verified all gowning/attire checklist items and am properly attired for production.',
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return { success: false, error: signatureResult.error || 'Failed to create electronic signature' };
  }

  await executeDbOperation(async (db) => {
    return db
      .update(table)
      .set({
        gownClean: input.checklistItems.gownClean,
        glovesOn: input.checklistItems.glovesOn,
        maskOn: input.checklistItems.maskOn,
        hairnetOn: input.checklistItems.hairnetOn,
        shoeCoverOn: input.checklistItems.shoeCoverOn,
        handsSanitized: input.checklistItems.handsSanitized,
        notes: input.checklistItems.notes || null,
        performedBy: input.userId,
        performedAt: getNow(),
        performedSignatureId: signatureResult.signatureId,
        status: 'performed',
        updatedAt: getNow(),
      })
      .where(eq(table.id, recordId));
  });

  const updated = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.id, recordId)).limit(1);
  });

  return { success: true, recordId, record: updated[0] as GowningRecord };
}

// ---------------------------------------------------------------------------
// Verify (different user) — approve / reject + e-signature
// ---------------------------------------------------------------------------

export async function verifyGowning(input: VerifyGowningInput): Promise<GowningResult> {
  const table = getTableRef('woGowningRecords');

  const records = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.id, input.recordId)).limit(1);
  });

  if (records.length === 0) {
    return { success: false, error: 'Gowning record not found' };
  }

  const record = records[0] as GowningRecord;

  if (record.status !== 'performed') {
    return { success: false, error: `Cannot verify record in status: ${record.status}. Must be 'performed' first.` };
  }

  if (record.performedBy === input.userId) {
    return { success: false, error: 'Verifier must be a different person from the performer (dual verification required)' };
  }

  const action = input.approved ? 'verify_approve' : 'verify_reject';
  const meaning = input.approved
    ? 'I confirm that I have reviewed and verified the gowning checklist and approve it.'
    : `I have reviewed the gowning checklist and reject it for the following reason: ${input.notes || 'Not specified'}`;

  const signatureResult: SignatureResult = await createElectronicSignature({
    entityType: 'wo_gowning',
    entityId: input.recordId,
    action,
    userId: input.userId,
    password: input.password,
    meaning,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  if (!signatureResult.success) {
    return { success: false, error: signatureResult.error || 'Failed to create electronic signature' };
  }

  const newStatus = input.approved ? 'verified' : 'rejected';
  const notes = input.notes
    ? (record.notes ? `${record.notes}\n[Verifier]: ${input.notes}` : `[Verifier]: ${input.notes}`)
    : record.notes;

  await executeDbOperation(async (db) => {
    return db
      .update(table)
      .set({
        verifiedBy: input.userId,
        verifiedAt: getNow(),
        verifiedSignatureId: signatureResult.signatureId,
        status: newStatus,
        notes,
        updatedAt: getNow(),
      })
      .where(eq(table.id, input.recordId));
  });

  const updated = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.id, input.recordId)).limit(1);
  });

  return { success: true, recordId: input.recordId, record: updated[0] as GowningRecord };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The single gowning record for a WO, enriched with performer/verifier names. */
export async function getGowningForWorkOrder(workOrderId: number): Promise<
  (GowningRecord & { performerName: string | null; verifierName: string | null }) | null
> {
  const table = getTableRef('woGowningRecords');
  const usersTable = getTableRef('users');

  const rows = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.workOrderId, workOrderId)).limit(1);
  });
  if (rows.length === 0) return null;
  const record = rows[0] as GowningRecord;

  const nameOf = async (userId: number | null): Promise<string | null> => {
    if (!userId) return null;
    const u = await executeDbOperation(async (db) => {
      return db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    });
    return u[0]?.name ?? null;
  };

  return {
    ...record,
    performerName: await nameOf(record.performedBy),
    verifierName: await nameOf(record.verifiedBy),
  };
}

/** Gowning record + signatures (for the recording UI detail view). */
export async function getGowningDetails(recordId: number): Promise<{
  record: GowningRecord | null;
  performerName?: string;
  verifierName?: string;
  signatures: Awaited<ReturnType<typeof getSignaturesForEntity>>;
}> {
  const table = getTableRef('woGowningRecords');
  const usersTable = getTableRef('users');

  const rows = await executeDbOperation(async (db) => {
    return db.select().from(table).where(eq(table.id, recordId)).limit(1);
  });
  if (rows.length === 0) return { record: null, signatures: [] };
  const record = rows[0] as GowningRecord;

  const nameOf = async (userId: number | null): Promise<string | undefined> => {
    if (!userId) return undefined;
    const u = await executeDbOperation(async (db) => {
      return db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    });
    return u[0]?.name;
  };

  return {
    record,
    performerName: await nameOf(record.performedBy),
    verifierName: await nameOf(record.verifiedBy),
    signatures: await getSignaturesForEntity('wo_gowning', recordId),
  };
}
