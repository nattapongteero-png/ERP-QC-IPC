/**
 * Water Quality Service
 * Feature: 023-environmental-monitoring
 */
import { eq, and, desc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { executeDbOperation, getTableRef, getInsertId } from '../db/db-helper';
import { getNow } from '../db/date-utils';
import {
  EnvMonitorError,
  ENV_MONITOR_ERROR_CODES,
  evaluateResult,
  type ResultStatus,
  type WaterSamplePoint,
  type WaterSystem,
  type WaterSystemType,
  type WaterQualitySpec,
} from '@/types/environmental-monitoring';

function getTables() {
  return {
    waterSystems: getTableRef('waterSystems'),
    samplePoints: getTableRef('waterSamplePoints'),
    specs: getTableRef('waterQualitySpecs'),
    tests: getTableRef('waterQualityTests'),
    testResults: getTableRef('waterQualityTestResults'),
    signatures: getTableRef('electronicSignatures'),
    deviations: getTableRef('deviations'),
    users: getTableRef('users'),
  };
}

// ============================================
// Systems
// ============================================

export async function listWaterSystems(includeInactive = false): Promise<WaterSystem[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = includeInactive
      ? await db.select().from(t.waterSystems)
      : await db.select().from(t.waterSystems).where(eq(t.waterSystems.isActive, true));
    return rows.map((r: any) => ({
      id: Number(r.id),
      code: String(r.code),
      name: String(r.name),
      systemType: r.systemType as WaterSystemType,
      description: r.description ?? null,
      isActive: Boolean(r.isActive),
      createdAt: String(r.createdAt),
    }));
  });
}

export async function createWaterSystem(input: {
  code: string;
  name: string;
  systemType: WaterSystemType;
  description?: string | null;
}): Promise<WaterSystem> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const dup = await db
      .select({ id: t.waterSystems.id })
      .from(t.waterSystems)
      .where(eq(t.waterSystems.code, input.code))
      .limit(1);
    if (dup.length > 0)
      throw new EnvMonitorError(
        ENV_MONITOR_ERROR_CODES.DUPLICATE_CODE,
        `Code ${input.code} already exists`,
      );
    const ins = await db.insert(t.waterSystems).values({
      code: input.code,
      name: input.name,
      systemType: input.systemType,
      description: input.description ?? null,
      isActive: true,
      createdAt: getNow(),
      updatedAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.waterSystems).where(eq(t.waterSystems.id, id)).limit(1);
    return {
      id,
      code: String(fresh[0].code),
      name: String(fresh[0].name),
      systemType: fresh[0].systemType as WaterSystemType,
      description: fresh[0].description ?? null,
      isActive: Boolean(fresh[0].isActive),
      createdAt: String(fresh[0].createdAt),
    };
  });
}

// ============================================
// Sample Points
// ============================================

export async function listSamplePoints(waterSystemId?: number): Promise<WaterSamplePoint[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = waterSystemId
      ? await db
          .select()
          .from(t.samplePoints)
          .where(
            and(
              eq(t.samplePoints.waterSystemId, waterSystemId),
              eq(t.samplePoints.isActive, true),
            ),
          )
      : await db.select().from(t.samplePoints).where(eq(t.samplePoints.isActive, true));
    return rows.map((r: any) => ({
      id: Number(r.id),
      waterSystemId: Number(r.waterSystemId),
      code: String(r.code),
      name: String(r.name),
      location: r.location ?? null,
      isActive: Boolean(r.isActive),
      createdAt: String(r.createdAt),
    }));
  });
}

export async function createSamplePoint(input: {
  waterSystemId: number;
  code: string;
  name: string;
  location?: string | null;
}): Promise<WaterSamplePoint> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const ins = await db.insert(t.samplePoints).values({
      waterSystemId: input.waterSystemId,
      code: input.code,
      name: input.name,
      location: input.location ?? null,
      isActive: true,
      createdAt: getNow(),
    });
    const id = getInsertId(ins);
    const fresh = await db.select().from(t.samplePoints).where(eq(t.samplePoints.id, id)).limit(1);
    return {
      id,
      waterSystemId: Number(fresh[0].waterSystemId),
      code: String(fresh[0].code),
      name: String(fresh[0].name),
      location: fresh[0].location ?? null,
      isActive: Boolean(fresh[0].isActive),
      createdAt: String(fresh[0].createdAt),
    };
  });
}

// ============================================
// Specs
// ============================================

export async function listSpecs(waterSystemId?: number): Promise<WaterQualitySpec[]> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const rows = waterSystemId
      ? await db
          .select()
          .from(t.specs)
          .where(
            and(eq(t.specs.waterSystemId, waterSystemId), eq(t.specs.isActive, true)),
          )
      : await db.select().from(t.specs).where(eq(t.specs.isActive, true));
    return rows.map((r: any) => ({
      id: Number(r.id),
      waterSystemId: Number(r.waterSystemId),
      samplePointId: r.samplePointId != null ? Number(r.samplePointId) : null,
      parameter: String(r.parameter),
      unit: String(r.unit),
      specMin: r.specMin != null ? Number(r.specMin) : null,
      specMax: r.specMax != null ? Number(r.specMax) : null,
      notes: r.notes ?? null,
      isActive: Boolean(r.isActive),
    }));
  });
}

export async function createSpec(input: {
  waterSystemId: number;
  samplePointId?: number | null;
  parameter: string;
  unit: string;
  specMin?: number | null;
  specMax?: number | null;
  notes?: string | null;
}): Promise<{ id: number }> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const ins = await db.insert(t.specs).values({
      waterSystemId: input.waterSystemId,
      samplePointId: input.samplePointId ?? null,
      parameter: input.parameter,
      unit: input.unit,
      specMin: input.specMin ?? null,
      specMax: input.specMax ?? null,
      notes: input.notes ?? null,
      isActive: true,
      createdAt: getNow(),
    });
    return { id: getInsertId(ins) };
  });
}

// ============================================
// Record a water quality test
// ============================================

export interface RecordWaterTestInput {
  samplePointId: number;
  waterSystemId: number;
  results: Array<{
    specId?: number | null;
    parameter: string;
    numericValue?: number | null;
    unit: string;
  }>;
  notes?: string | null;
  signature: { password?: string; pin?: string };
}

export interface RecordWaterTestResult {
  testId: number;
  overallResult: ResultStatus;
  outOfSpecCount: number;
  deviationId: number | null;
}

export async function recordWaterTest(
  input: RecordWaterTestInput,
  userId: number,
): Promise<RecordWaterTestResult> {
  return executeDbOperation(async (db) => {
    const t = getTables();

    // Load applicable specs (by point or system)
    const allSpecs = await db
      .select()
      .from(t.specs)
      .where(
        and(
          eq(t.specs.waterSystemId, input.waterSystemId),
          eq(t.specs.isActive, true),
        ),
      );
    const specsByParam = new Map<string, any>();
    for (const s of allSpecs) {
      // Prefer spec specific to sample point over system-wide
      const key = String(s.parameter);
      const existing = specsByParam.get(key);
      if (
        !existing ||
        (s.samplePointId != null && Number(s.samplePointId) === input.samplePointId)
      ) {
        specsByParam.set(key, s);
      }
    }

    // User
    const userRows = await db.select().from(t.users).where(eq(t.users.id, userId)).limit(1);
    if (userRows.length === 0)
      throw new EnvMonitorError(ENV_MONITOR_ERROR_CODES.NOT_FOUND, 'User not found');
    const user = userRows[0];

    // Signature
    const sigHash = createHash('sha256')
      .update(`water-test|${userId}|${input.samplePointId}|${Date.now()}`)
      .digest('hex');
    const sigIns = await db.insert(t.signatures).values({
      entityType: 'water_quality_test',
      entityId: 0,
      action: 'perform',
      userId,
      username: user.username ?? user.email ?? '',
      fullName: user.fullName ?? user.username ?? user.email ?? '',
      title: user.title ?? null,
      signedAt: getNow(),
      meaning: `Water quality test on sample point #${input.samplePointId}`,
      passwordVerified: Boolean(input.signature.password),
      signatureHash: sigHash,
      createdAt: getNow(),
    });
    const signatureId = getInsertId(sigIns);

    // Evaluate each result against spec
    let outOfSpecCount = 0;
    const evaluated = input.results.map((r) => {
      const spec = specsByParam.get(r.parameter);
      const min = spec?.specMin != null ? Number(spec.specMin) : null;
      const max = spec?.specMax != null ? Number(spec.specMax) : null;
      const result = evaluateResult(r.numericValue ?? null, min, max);
      if (result === 'out_of_spec') outOfSpecCount++;
      return {
        specId: spec?.id ?? r.specId ?? null,
        parameter: r.parameter,
        numericValue: r.numericValue ?? null,
        unit: r.unit,
        specMinSnapshot: min,
        specMaxSnapshot: max,
        result,
      };
    });

    const overallResult: ResultStatus = outOfSpecCount > 0 ? 'out_of_spec' : 'in_spec';

    // Insert test
    const testIns = await db.insert(t.tests).values({
      samplePointId: input.samplePointId,
      waterSystemId: input.waterSystemId,
      performedAt: getNow(),
      operatorUserId: userId,
      signatureId,
      overallResult,
      notes: input.notes ?? null,
      createdAt: getNow(),
    });
    const testId = getInsertId(testIns);

    await db.update(t.signatures).set({ entityId: testId }).where(eq(t.signatures.id, signatureId));

    // Insert per-result rows
    for (const r of evaluated) {
      await db.insert(t.testResults).values({
        testId,
        specId: r.specId,
        parameter: r.parameter,
        numericValue: r.numericValue,
        unit: r.unit,
        specMinSnapshot: r.specMinSnapshot,
        specMaxSnapshot: r.specMaxSnapshot,
        result: r.result,
        createdAt: getNow(),
      });
    }

    // Auto-deviation on out-of-spec
    let deviationId: number | null = null;
    if (outOfSpecCount > 0) {
      try {
        const devNumber = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const devIns = await db.insert(t.deviations).values({
          deviationNumber: devNumber,
          deviationType: 'water_quality_out_of_spec',
          severity: 'major',
          title: `Water OUT-OF-SPEC at sample point #${input.samplePointId}`,
          description: `${outOfSpecCount} item(s) outside specification. See test #${testId}.`,
          reportedBy: userId,
          reportedAt: getNow(),
          status: 'open',
          createdAt: getNow(),
          updatedAt: getNow(),
        });
        deviationId = getInsertId(devIns);
        await db.update(t.tests).set({ deviationId }).where(eq(t.tests.id, testId));
      } catch (err) {
        console.warn('[water-quality] deviation creation failed', err);
      }

      // Notification
      try {
        const { createNotification } = await import('./equipment-notification.service');
        await createNotification({
          entityType: 'water_system',
          entityId: input.waterSystemId,
          type: 'inspection_due',
          title: `Water OUT-OF-SPEC at sample point #${input.samplePointId}`,
          body: `${outOfSpecCount} parameter(s) out of spec. Deviation ${deviationId ?? 'pending'}.`,
          severity: 'overdue',
          recipientRole: 'qa',
        });
      } catch {}
    }

    return { testId, overallResult, outOfSpecCount, deviationId };
  });
}

// ============================================
// Trend
// ============================================

export async function getWaterTrend(
  samplePointId: number,
  parameter: string,
  days: number = 30,
): Promise<Array<{ performedAt: string; value: number | null; result: ResultStatus }>> {
  return executeDbOperation(async (db) => {
    const t = getTables();
    const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
    const rows = await db
      .select({
        performedAt: t.tests.performedAt,
        value: t.testResults.numericValue,
        result: t.testResults.result,
      })
      .from(t.testResults)
      .leftJoin(t.tests, eq(t.tests.id, t.testResults.testId))
      .where(
        and(
          eq(t.tests.samplePointId, samplePointId),
          eq(t.testResults.parameter, parameter),
          sql`${t.tests.performedAt} >= ${since}`,
        ),
      )
      .orderBy(t.tests.performedAt);

    return rows.map((r: any) => ({
      performedAt: String(r.performedAt),
      value: r.value != null ? Number(r.value) : null,
      result: r.result as ResultStatus,
    }));
  });
}
