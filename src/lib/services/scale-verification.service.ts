/**
 * Scale Verification Service — verify scales with standard weights
 * Feature: 021-scale-verification
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow, toDbDate } from '../db/date-utils';
import {
  ScaleVerificationError,
  SCALE_VERIFICATION_ERROR_CODES,
  computeDeviationPercent,
  evaluateResult,
  isExtremeDeviation,
  type CreateVerificationInput,
  type ScaleVerification,
  type StandardWeight,
} from '@/types/scale-verification';

function getTables() {
  return {
    weights: getTableRef('standardWeights'),
    verifications: getTableRef('scaleVerifications'),
    equipment: getTableRef('productionEquipment'),
    signatures: getTableRef('electronicSignatures'),
    users: getTableRef('users'),
  };
}

// ============================================
// Standard Weights — CRUD
// ============================================

export async function listStandardWeights(includeInactive = false): Promise<StandardWeight[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = includeInactive
      ? await db.select().from(t.weights)
      : await db.select().from(t.weights).where(eq(t.weights.isActive, true));
    return rows.map(normalizeWeight);
  });
}

export async function createStandardWeight(
  input: {
    code: string;
    denominationValue: number;
    denominationUnit: string;
    accuracyClass: string;
    certificateNumber: string;
    certificateIssuer: string;
    certificateIssueDate: string;
    certificateExpiryDate: string;
    ownerDepartment?: string | null;
    notes?: string | null;
  },
  userId: number,
): Promise<StandardWeight> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    const existing = await db
      .select({ id: t.weights.id })
      .from(t.weights)
      .where(eq(t.weights.code, input.code))
      .limit(1);
    if (existing.length > 0) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.DUPLICATE_WEIGHT_CODE,
        `Standard weight code "${input.code}" already exists`,
      );
    }

    const ins = await db.insert(t.weights).values({
      code: input.code,
      denominationValue: input.denominationValue,
      denominationUnit: input.denominationUnit,
      accuracyClass: input.accuracyClass,
      certificateNumber: input.certificateNumber,
      certificateIssuer: input.certificateIssuer,
      certificateIssueDate: toDbDate(input.certificateIssueDate),
      certificateExpiryDate: toDbDate(input.certificateExpiryDate),
      ownerDepartment: input.ownerDepartment ?? null,
      notes: input.notes ?? null,
      isActive: true,
      createdByUserId: userId,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.weights).where(eq(t.weights.id, id)).limit(1);
    return normalizeWeight(fresh[0]);
  });
}

export async function updateStandardWeight(
  id: number,
  patch: Record<string, unknown>,
): Promise<StandardWeight> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    await db
      .update(t.weights)
      .set({ ...patch, updatedAt: getNow() })
      .where(eq(t.weights.id, id));
    const fresh = await db.select().from(t.weights).where(eq(t.weights.id, id)).limit(1);
    if (fresh.length === 0)
      throw new ScaleVerificationError(SCALE_VERIFICATION_ERROR_CODES.NOT_FOUND, 'Not found');
    return normalizeWeight(fresh[0]);
  });
}

// ============================================
// Verification — create + lookup
// ============================================

export async function getCurrentVerificationForScale(
  scaleId: number,
): Promise<ScaleVerification | null> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const nowIso = new Date().toISOString();
    const rows = await db
      .select()
      .from(t.verifications)
      .where(
        and(
          eq(t.verifications.scaleId, scaleId),
          eq(t.verifications.result, 'pass'),
          sql`${t.verifications.validUntil} > ${nowIso}`,
        ),
      )
      .orderBy(desc(t.verifications.performedAt))
      .limit(1);
    return rows.length > 0 ? normalizeVerification(rows[0]) : null;
  });
}

export async function listVerificationsForScale(
  scaleId: number,
  limit = 100,
): Promise<Array<ScaleVerification & {
  weightCode: string | null;
  weightDenomination: string | null;
  operatorName: string | null;
}>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const users = getTableRef('users');
    // Joining users + weights here lets the history page render the
    // operator name and the weight that was used without N+1 lookups.
    const rows = await db
      .select({
        verification: t.verifications,
        weightCode: t.weights.code,
        weightDenominationValue: t.weights.denominationValue,
        weightDenominationUnit: t.weights.denominationUnit,
        operatorName: users.name,
      })
      .from(t.verifications)
      .leftJoin(t.weights, eq(t.weights.id, t.verifications.standardWeightId))
      .leftJoin(users, eq(users.id, t.verifications.operatorUserId))
      .where(eq(t.verifications.scaleId, scaleId))
      .orderBy(desc(t.verifications.performedAt))
      .limit(limit);
    return rows.map((r: any) => ({
      ...normalizeVerification(r.verification),
      weightCode: r.weightCode != null ? String(r.weightCode) : null,
      weightDenomination: r.weightDenominationValue != null
        ? `${Number(r.weightDenominationValue)} ${r.weightDenominationUnit ?? ''}`.trim()
        : null,
      operatorName: r.operatorName != null ? String(r.operatorName) : null,
    }));
  });
}

export async function createVerification(
  input: CreateVerificationInput,
  userId: number,
): Promise<ScaleVerification> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Load scale
    const scaleRows = await db
      .select()
      .from(t.equipment)
      .where(eq(t.equipment.id, input.scaleId))
      .limit(1);
    if (scaleRows.length === 0)
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.SCALE_NOT_FOUND,
        'Scale not found',
      );
    const scale = scaleRows[0];

    if (scale.scaleStatus === 'out_of_service' || scale.scaleStatus === 'maintenance') {
      // Allow verification — that's how scale comes back to service
      // But block if equipment is inactive entirely
    }
    if (!scale.isActive) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.SCALE_OUT_OF_SERVICE,
        'Scale is inactive',
      );
    }

    // Load weight
    const weightRows = await db
      .select()
      .from(t.weights)
      .where(eq(t.weights.id, input.standardWeightId))
      .limit(1);
    if (weightRows.length === 0)
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.STANDARD_WEIGHT_NOT_FOUND,
        'Standard weight not found',
      );
    const weight = weightRows[0];

    // Certificate validity
    const today = new Date().toISOString().slice(0, 10);
    const expiryStr = typeof weight.certificateExpiryDate === 'string'
      ? weight.certificateExpiryDate.slice(0, 10)
      : new Date(weight.certificateExpiryDate).toISOString().slice(0, 10);
    if (expiryStr < today) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.CERTIFICATE_EXPIRED,
        `Certificate expired on ${expiryStr}`,
        { expiry: expiryStr },
      );
    }

    if (!weight.isActive) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.STANDARD_WEIGHT_NOT_FOUND,
        'Standard weight is inactive',
      );
    }

    const certifiedValue = Number(weight.denominationValue);
    const actualReading = input.actualReading;

    if (isExtremeDeviation(certifiedValue, actualReading)) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.EXTREME_DEVIATION,
        'Reading exceeds 10× certified value — likely wrong weight selected',
        { certified: certifiedValue, actual: actualReading },
      );
    }

    // Check scale weight range if configured
    const certifiedInGrams = toGrams(certifiedValue, String(weight.denominationUnit));
    if (scale.minVerificationWeightG && certifiedInGrams < Number(scale.minVerificationWeightG)) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.WEIGHT_OUT_OF_RANGE,
        `Standard weight ${certifiedInGrams}g below minimum for this scale (${scale.minVerificationWeightG}g)`,
      );
    }
    if (scale.maxVerificationWeightG && certifiedInGrams > Number(scale.maxVerificationWeightG)) {
      throw new ScaleVerificationError(
        SCALE_VERIFICATION_ERROR_CODES.WEIGHT_OUT_OF_RANGE,
        `Standard weight ${certifiedInGrams}g above maximum for this scale (${scale.maxVerificationWeightG}g)`,
      );
    }

    const tolerancePercent = Number(scale.tolerancePercent ?? 0.1);
    const intervalHours = Number(scale.verificationIntervalHours ?? 8);

    const deviationAmount = actualReading - certifiedValue;
    const deviationPercent = computeDeviationPercent(certifiedValue, actualReading);
    const result = evaluateResult(deviationPercent, tolerancePercent);

    // User
    const userRows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
    if (userRows.length === 0)
      throw new ScaleVerificationError(SCALE_VERIFICATION_ERROR_CODES.NOT_FOUND, 'User not found');
    const user = userRows[0];

    const performedAt = new Date();
    const validUntil = new Date(performedAt.getTime() + intervalHours * 3600 * 1000);

    // Signature
    const sigHash = createHash('sha256')
      .update(`scale-verify|${userId}|${input.scaleId}|${input.standardWeightId}|${actualReading}|${performedAt.getTime()}`)
      .digest('hex');
    const sigIns = await db.insert(t.signatures).values({
      entityType: 'scale_verification',
      entityId: 0, // updated after insert
      action: 'perform',
      userId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `Operator verified scale ${scale.code} with ${weight.code}: ${result.toUpperCase()} (Δ ${deviationPercent}%)`,
      passwordVerified: Boolean(input.signature.password),
      signatureHash: sigHash,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigIns);

    // Insert verification
    const verIns = await db.insert(t.verifications).values({
      scaleId: input.scaleId,
      standardWeightId: input.standardWeightId,
      certifiedValueSnapshot: certifiedValue,
      certifiedUnitSnapshot: String(weight.denominationUnit),
      actualReading,
      deviationAmount,
      deviationPercent,
      result,
      operatorUserId: userId,
      signatureId,
      performedAt: toDbDate(performedAt),
      validUntil: toDbDate(validUntil),
      notes: input.notes ?? null,
      createdAt: getNow(),
    });
    const verId = getInsertId(verIns);

    // Update signature entityId
    await db
      .update(t.signatures)
      .set({ entityId: verId })
      .where(eq(t.signatures.id, signatureId));

    // If FAIL → set scale to out_of_service + create notification (F022)
    if (result === 'fail') {
      await db
        .update(t.equipment)
        .set({ scaleStatus: 'out_of_service', updatedAt: getNow() })
        .where(eq(t.equipment.id, input.scaleId));

      // Feature 022 integration: auto-create high-severity notification
      try {
        const { createNotification } = await import('./equipment-notification.service');
        await createNotification({
          entityType: 'scale',
          entityId: input.scaleId,
          type: 'scale_failure',
          title: `Scale ${scale.code} FAILED verification`,
          body: `Verification by user ${userId} with weight ${weight.code} measured Δ ${deviationPercent}% (tolerance ±${tolerancePercent}%). Scale set to Out of Service.`,
          dueAt: new Date().toISOString(),
          severity: 'overdue',
          recipientRole: 'maintenance',
        });
      } catch (notifyErr) {
        // Non-fatal — verification record still saved
        console.warn('[scale-verification] notification creation failed', notifyErr);
      }
    } else {
      // If PASS, ensure scaleStatus is 'active' (in case it was previously out)
      if (scale.scaleStatus === 'out_of_service') {
        await db
          .update(t.equipment)
          .set({ scaleStatus: 'active', updatedAt: getNow() })
          .where(eq(t.equipment.id, input.scaleId));
      }
    }

    const fresh = await db.select().from(t.verifications).where(eq(t.verifications.id, verId)).limit(1);
    return normalizeVerification(fresh[0]);
  });
}

// ============================================
// Dashboard helpers
// ============================================

export async function getScalesNeedingVerification(): Promise<Array<{
  scaleId: number;
  scaleCode: string;
  scaleName: string;
  status: string;
  lastVerifiedAt: string | null;
  lastResult: string | null;
  // Adds the actual reading + which standard weight was used last time so
  // operators can see the trail at a glance on the list view instead of
  // having to open a separate detail page.
  lastActualReading: number | null;
  lastCertifiedValue: number | null;
  lastDeviationPercent: number | null;
  lastWeightCode: string | null;
  lastWeightDenomination: string | null;
  // Acceptable standard-weight range for this scale (grams). Lets the UI offer
  // only weights that fit, and tell the operator roughly what reading to enter.
  minVerificationWeightG: number | null;
  maxVerificationWeightG: number | null;
  // Calibration certificate of the scale itself (number + expiry) so the list
  // can show it and warn when it's expiring/expired.
  calibrationCertNumber: string | null;
  calibrationExpiryDate: string | null;
}>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const scales = await db
      .select({
        id: t.equipment.id,
        code: t.equipment.code,
        name: t.equipment.name,
        scaleStatus: t.equipment.scaleStatus,
        minVerificationWeightG: t.equipment.minVerificationWeightG,
        maxVerificationWeightG: t.equipment.maxVerificationWeightG,
        calibrationCertNumber: t.equipment.calibrationCertNumber,
        calibrationExpiryDate: t.equipment.calibrationExpiryDate,
      })
      .from(t.equipment)
      .where(
        and(
          sql`${t.equipment.equipmentType} IN ('scale', 'balance')`,
          eq(t.equipment.isActive, true),
        ),
      );

    const result = [] as Array<{
      scaleId: number;
      scaleCode: string;
      scaleName: string;
      status: string;
      lastVerifiedAt: string | null;
      lastResult: string | null;
      lastActualReading: number | null;
      lastCertifiedValue: number | null;
      lastDeviationPercent: number | null;
      lastWeightCode: string | null;
      lastWeightDenomination: string | null;
      minVerificationWeightG: number | null;
      maxVerificationWeightG: number | null;
      calibrationCertNumber: string | null;
      calibrationExpiryDate: string | null;
    }>;
    for (const s of scales) {
      const lastVer = await db
        .select({
          performedAt: t.verifications.performedAt,
          result: t.verifications.result,
          actualReading: t.verifications.actualReading,
          certifiedValue: t.verifications.certifiedValueSnapshot,
          certifiedUnit: t.verifications.certifiedUnitSnapshot,
          deviationPercent: t.verifications.deviationPercent,
          weightCode: t.weights.code,
          weightDenominationValue: t.weights.denominationValue,
          weightDenominationUnit: t.weights.denominationUnit,
        })
        .from(t.verifications)
        .leftJoin(t.weights, eq(t.weights.id, t.verifications.standardWeightId))
        .where(eq(t.verifications.scaleId, Number(s.id)))
        .orderBy(desc(t.verifications.performedAt))
        .limit(1);

      const last = lastVer[0];
      result.push({
        scaleId: Number(s.id),
        scaleCode: String(s.code),
        scaleName: String(s.name),
        status: String(s.scaleStatus ?? 'active'),
        lastVerifiedAt: last ? String(last.performedAt) : null,
        lastResult: last ? String(last.result) : null,
        lastActualReading: last?.actualReading != null ? Number(last.actualReading) : null,
        lastCertifiedValue: last?.certifiedValue != null ? Number(last.certifiedValue) : null,
        lastDeviationPercent: last?.deviationPercent != null ? Number(last.deviationPercent) : null,
        lastWeightCode: last?.weightCode != null ? String(last.weightCode) : null,
        lastWeightDenomination: last?.weightDenominationValue != null
          ? `${Number(last.weightDenominationValue)} ${last.weightDenominationUnit ?? ''}`.trim()
          : null,
        minVerificationWeightG:
          s.minVerificationWeightG != null ? Number(s.minVerificationWeightG) : null,
        maxVerificationWeightG:
          s.maxVerificationWeightG != null ? Number(s.maxVerificationWeightG) : null,
        calibrationCertNumber: s.calibrationCertNumber ? String(s.calibrationCertNumber) : null,
        calibrationExpiryDate: s.calibrationExpiryDate ? String(s.calibrationExpiryDate) : null,
      });
    }
    return result;
  });
}

// ============================================
// Helpers
// ============================================

function toGrams(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'kg':
      return value * 1000;
    case 'mg':
      return value / 1000;
    default:
      return value; // g
  }
}

function normalizeWeight(row: any): StandardWeight {
  return {
    id: Number(row.id),
    code: String(row.code),
    denominationValue: Number(row.denominationValue),
    denominationUnit: String(row.denominationUnit),
    accuracyClass: row.accuracyClass,
    certificateNumber: String(row.certificateNumber),
    certificateIssuer: String(row.certificateIssuer),
    certificateIssueDate:
      typeof row.certificateIssueDate === 'string'
        ? row.certificateIssueDate.slice(0, 10)
        : new Date(row.certificateIssueDate).toISOString().slice(0, 10),
    certificateExpiryDate:
      typeof row.certificateExpiryDate === 'string'
        ? row.certificateExpiryDate.slice(0, 10)
        : new Date(row.certificateExpiryDate).toISOString().slice(0, 10),
    ownerDepartment: row.ownerDepartment ?? null,
    isActive: Boolean(row.isActive),
    notes: row.notes ?? null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

function normalizeVerification(row: any): ScaleVerification {
  return {
    id: Number(row.id),
    scaleId: Number(row.scaleId),
    standardWeightId: Number(row.standardWeightId),
    certifiedValueSnapshot: Number(row.certifiedValueSnapshot),
    certifiedUnitSnapshot: String(row.certifiedUnitSnapshot),
    actualReading: Number(row.actualReading),
    deviationAmount: Number(row.deviationAmount),
    deviationPercent: Number(row.deviationPercent),
    result: row.result as 'pass' | 'fail',
    operatorUserId: Number(row.operatorUserId),
    signatureId: row.signatureId != null ? Number(row.signatureId) : null,
    performedAt: String(row.performedAt),
    validUntil: String(row.validUntil),
    notes: row.notes ?? null,
    createdAt: String(row.createdAt),
  };
}
