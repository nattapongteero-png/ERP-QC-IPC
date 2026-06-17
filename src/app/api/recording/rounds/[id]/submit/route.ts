import { NextRequest } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, dbDate } from '@/lib/db/db-helper';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { parseSpecPayload, type SpecPayload } from '@/lib/master-data/ipc-spec-payload';
import { evaluateFormula } from '@/lib/utils/safe-formula';

const ROUNDS_TABLE = 'iPCRecordingRounds';
const CRITERIA_TABLE = 'iPCCriteria';

// POST /api/recording/rounds/:id/submit
// Locks the round and computes pass/fail server-side based on criteria spec.
// Body: ignored (e-signature deferred to future phase).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const roundId = Number(id);
      if (!Number.isFinite(roundId)) return errorResponse('Invalid id');

      const rounds = getTableRef(ROUNDS_TABLE);
      const criteria = getTableRef(CRITERIA_TABLE);

      const [round] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      if (!round) return errorResponse('Round not found', 404);
      if (round.submittedAt) return errorResponse('Round already submitted', 409);

      const [crit] = await executeDbOperation(async (db) => {
        return db.select().from(criteria).where(eq(criteria.id, round.criteriaId));
      });
      if (!crit) return errorResponse('Criteria not found', 404);

      // Compute pass/fail server-side for audit trust
      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(round.data || '{}');
      } catch {
        parsedData = {};
      }
      const outcome = await computeOutcome(crit, parsedData);

      await executeDbOperation(async (db) => {
        return db.update(rounds).set({
          submittedAt: dbDate(),
          submittedById: session.userId,
          passed: outcome.passed,
          computedMean: outcome.mean,
          outcomeNote: outcome.note,
        }).where(eq(rounds.id, roundId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'ipc_recording_rounds',
        recordId: roundId,
        newValue: { submitted: true, passed: outcome.passed, mean: outcome.mean },
        ipAddress: getClientIP(request),
      });

      // Sync the linked quality_tests row so the WO Execution Dashboard IPC
      // progress + Production Output gate can see this new-type result. Without
      // this, the round writes only to ipc_recording_rounds and the batch never
      // reaches 100% IPC completion (gate locks permanently).
      const syncedQtId = await syncQualityTest({
        criteriaId: round.criteriaId,
        batchNumber: String(round.batchNumber ?? ''),
        outcome,
        testedById: session.userId,
      });
      if (syncedQtId != null) {
        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'quality_tests',
          recordId: syncedQtId,
          newValue: {
            status: outcome.passed === true ? 'pass' : outcome.passed === false ? 'fail' : 'pending',
            source: 'ipc_recording_round',
            roundId,
          },
          ipAddress: getClientIP(request),
        });
      }

      const [updated] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      return successResponse(updated, 'Round submitted');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

interface Outcome {
  passed: boolean | null;
  mean: number | null;
  note: string;
}

// Server-side outcome computation. Trust must not depend on client. Mirrors the
// pass/fail logic the recorder UI shows (Recorders.tsx) so the audited result
// matches what the operator saw.
async function computeOutcome(
  crit: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<Outcome> {
  const type = String(crit.criteriaType ?? 'numeric');

  if (type === 'numeric' || type === 'tare') {
    const raw = data.value;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { passed: null, mean: null, note: 'no value' };
    // tare acceptance bounds live in the spec payload; numeric uses min/maxValue.
    let min = numOrNull(crit.minValue);
    let max = numOrNull(crit.maxValue);
    if (type === 'tare') {
      const spec = parseSpecPayload(type, crit.specification);
      if (spec?.type === 'tare') {
        if (spec.acceptanceMin !== '') min = numOrNull(spec.acceptanceMin);
        if (spec.acceptanceMax !== '') max = numOrNull(spec.acceptanceMax);
      }
    }
    if (min == null && max == null) return { passed: true, mean: n, note: 'no range' };
    const ok = (min == null || n >= min) && (max == null || n <= max);
    return { passed: ok, mean: n, note: ok ? 'in range' : 'out of range' };
  }

  if (type === 'pass_fail') {
    const v = String(data.value ?? '');
    return { passed: v === 'pass', mean: null, note: v };
  }

  if (type === 'visual') {
    const checks = isObject(data.checks) ? data.checks : {};
    const values = Object.values(checks);
    const allOk = values.length > 0 && values.every((x) => x === true);
    return { passed: allOk, mean: null, note: `${values.filter(Boolean).length}/${values.length}` };
  }

  if (type === 'text') {
    const v = String(data.value ?? '').trim();
    return { passed: v.length > 0, mean: null, note: 'text recorded' };
  }

  const spec = parseSpecPayload(type, crit.specification);

  if (type === 'multi_point') {
    return computeMultiPoint(spec, data);
  }

  if (type === 'calibration') {
    return computeCalibration(spec, data);
  }

  if (type === 'calculated') {
    return computeCalculated(spec, data);
  }

  if (type === 'custom_multi_field') {
    return computeCustomMultiField(spec, data);
  }

  return { passed: null, mean: null, note: 'unknown type' };
}

// Multi-point: N points, optional tare cross-reference. Mirrors MultiPointRecorder.
async function computeMultiPoint(spec: SpecPayload | null, data: Record<string, unknown>): Promise<Outcome> {
  if (!spec || spec.type !== 'multi_point') return { passed: null, mean: null, note: 'no spec' };
  const pointCount = Math.max(2, Math.min(200, Number(spec.pointCount) || 20));
  const rawPoints = Array.isArray(data.points) ? (data.points as unknown[]) : [];
  const nums = rawPoints.map((p) => Number(p)).filter((n): n is number => Number.isFinite(n));

  const target = Number(spec.perPointTarget);
  const tol = Number(spec.perPointTolerance);
  const min = Number.isFinite(target) && Number.isFinite(tol) ? target * (1 - tol / 100) : null;
  const max = Number.isFinite(target) && Number.isFinite(tol) ? target * (1 + tol / 100) : null;

  const usingTare = !!spec.tareSourceCode;
  const tareMean = usingTare ? await lookupTareMean(spec.tareSourceCode) : null;

  if (nums.length < pointCount) {
    // Incomplete — record mean of what's there but no pass/fail decision.
    const partialMean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    return { passed: null, mean: partialMean, note: `incomplete (${nums.length}/${pointCount})` };
  }

  const meanGross = nums.reduce((a, b) => a + b, 0) / nums.length;
  const meanNet = tareMean != null ? meanGross - tareMean : null;
  const checkValue = (n: number) => {
    const v = usingTare && tareMean != null ? n - tareMean : n;
    return (min == null || v >= min) && (max == null || v <= max);
  };
  let passed: boolean | null = null;
  if (spec.aggregateRule === 'all_pass' || spec.aggregateRule === 'min_max') {
    passed = nums.every(checkValue);
  } else if (spec.aggregateRule === 'mean') {
    const checkMean = meanNet ?? meanGross;
    passed = (min == null || checkMean >= min) && (max == null || checkMean <= max);
  } else if (spec.aggregateRule === 'rsd') {
    // RSD% = stddev/mean*100 ≤ aggregateLimit
    const base = meanNet ?? meanGross;
    const variance = nums.reduce((a, b) => a + (b - meanGross) ** 2, 0) / nums.length;
    const rsd = base !== 0 ? (Math.sqrt(variance) / Math.abs(base)) * 100 : Infinity;
    const limit = spec.aggregateLimit === '' ? null : Number(spec.aggregateLimit);
    passed = limit != null && Number.isFinite(limit) ? rsd <= limit : null;
  }
  const reportMean = meanNet ?? meanGross;
  return { passed, mean: reportMean, note: `${spec.aggregateRule} of ${nums.length} points` };
}

// Calibration: |measured - standard| ≤ tolerance. Mirrors CalibrationRecorder.
function computeCalibration(spec: SpecPayload | null, data: Record<string, unknown>): Outcome {
  if (!spec || spec.type !== 'calibration') return { passed: null, mean: null, note: 'no spec' };
  const measured = Number(data.value);
  const standard = Number(spec.standardValue);
  const tol = Number(spec.toleranceValue);
  if (!Number.isFinite(measured)) return { passed: null, mean: null, note: 'no value' };
  if (!Number.isFinite(standard) || !Number.isFinite(tol)) {
    return { passed: null, mean: measured, note: 'spec incomplete' };
  }
  const limit = spec.toleranceType === 'percent' ? standard * (tol / 100) : tol;
  const ok = Math.abs(measured - standard) <= limit;
  return { passed: ok, mean: measured, note: ok ? 'within tolerance' : 'out of tolerance' };
}

// Calculated: evaluate formula over named inputs vs result min/max. Mirrors CalculatedRecorder.
function computeCalculated(spec: SpecPayload | null, data: Record<string, unknown>): Outcome {
  if (!spec || spec.type !== 'calculated') return { passed: null, mean: null, note: 'no spec' };
  const inputs = isObject(data.inputs) ? (data.inputs as Record<string, unknown>) : {};
  const vars: Record<string, number> = {};
  for (const inp of spec.inputs) {
    if (!inp.name) continue;
    if (inp.source === 'constant') {
      const n = Number(inp.constantValue);
      if (Number.isFinite(n)) vars[inp.name] = n;
    } else {
      const n = Number(inputs[inp.id]);
      if (Number.isFinite(n)) vars[inp.name] = n;
    }
  }
  const allFilled = spec.inputs
    .filter((i) => i.source !== 'constant')
    .every((i) => i.name && inputs[i.id] != null && inputs[i.id] !== '');
  if (!allFilled) return { passed: null, mean: null, note: 'inputs incomplete' };
  const result = evaluateFormula(spec.formula, vars);
  if (result == null) return { passed: null, mean: null, note: 'formula error' };
  const min = spec.resultMin === '' ? null : Number(spec.resultMin);
  const max = spec.resultMax === '' ? null : Number(spec.resultMax);
  if (min == null && max == null) return { passed: true, mean: result, note: 'no range' };
  const ok = (min == null || result >= min) && (max == null || result <= max);
  return { passed: ok, mean: result, note: ok ? 'in range' : 'out of range' };
}

// Custom multi-field: every required field present + number fields within tolerance.
// Mirrors CustomFieldsRecorder's per-field status.
function computeCustomMultiField(spec: SpecPayload | null, data: Record<string, unknown>): Outcome {
  if (!spec || spec.type !== 'custom_multi_field') return { passed: null, mean: null, note: 'no spec' };
  const values = isObject(data.values) ? (data.values as Record<string, unknown>) : {};
  if (spec.fields.length === 0) return { passed: null, mean: null, note: 'no fields' };
  let anyEvaluated = false;
  for (const f of spec.fields) {
    const raw = values[f.id];
    const v = raw == null ? '' : String(raw);
    if (f.required && v.trim() === '') {
      return { passed: false, mean: null, note: `missing: ${f.label || f.id}` };
    }
    if (f.fieldType === 'number' && v !== '') {
      const n = Number(v);
      const target = Number(f.target);
      const tol = Number(f.tolerance);
      if (Number.isFinite(n) && Number.isFinite(target) && Number.isFinite(tol)) {
        anyEvaluated = true;
        if (Math.abs(n - target) > target * (tol / 100)) {
          return { passed: false, mean: null, note: `out of range: ${f.label || f.id}` };
        }
      }
    }
  }
  // All required filled and no numeric field out of range.
  void anyEvaluated;
  return { passed: true, mean: null, note: 'all fields ok' };
}

// Latest submitted round mean for a tare criteria, by code. Mirrors tare-lookup route.
async function lookupTareMean(code: string): Promise<number | null> {
  if (!code) return null;
  const criteria = getTableRef(CRITERIA_TABLE);
  const rounds = getTableRef(ROUNDS_TABLE);
  const [crit] = await executeDbOperation(async (db) =>
    db.select().from(criteria).where(eq(criteria.code, code)),
  );
  if (!crit) return null;
  const [latest] = await executeDbOperation(async (db) =>
    db
      .select()
      .from(rounds)
      .where(and(eq(rounds.criteriaId, crit.id), isNotNull(rounds.submittedAt)))
      .orderBy(desc(rounds.submittedAt))
      .limit(1),
  );
  if (!latest) return null;
  if (latest.computedMean != null) return Number(latest.computedMean);
  try {
    const d = JSON.parse(latest.data || '{}');
    const points = Array.isArray(d.points) ? d.points.map(Number).filter(Number.isFinite) : [];
    if (points.length > 0) return points.reduce((a: number, b: number) => a + b, 0) / points.length;
    if (Number.isFinite(Number(d.value))) return Number(d.value);
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Sync the WO-linked quality_tests row for this criteria + batch so the
 * Execution Dashboard IPC progress + Production Output gate reflect the result.
 *
 * Linkage: quality_tests.ipcCriteriaId = criteriaId, testType='in_process', and
 * the test's lot has batchNumber matching the round's batchNumber. We update the
 * most recent matching pending/retest row. Nullable columns are coerced to null
 * (never undefined) to keep the MySQL prepared-statement bind count stable.
 *
 * Returns the updated quality_tests.id, or null when no linkable row exists
 * (e.g. ad-hoc cleaning/equipment-qual rounds with no WO context).
 */
async function syncQualityTest(args: {
  criteriaId: number;
  batchNumber: string;
  outcome: Outcome;
  testedById: number;
}): Promise<number | null> {
  const { criteriaId, batchNumber, outcome, testedById } = args;
  if (!batchNumber) return null;
  // Don't overwrite a row with a non-decisive outcome (incomplete round).
  if (outcome.passed == null) return null;

  return executeDbOperation(async (db) => {
    const qt = getTableRef('qualityTests');
    const lots = getTableRef('inventoryLots');

    // Find the IPC test row for this criteria whose lot belongs to this batch.
    const rows = await db
      .select({ id: qt.id, status: qt.status })
      .from(qt)
      .innerJoin(lots, eq(qt.lotId, lots.id))
      .where(
        and(
          eq(qt.ipcCriteriaId, criteriaId),
          eq(qt.testType, 'in_process'),
          eq(lots.batchNumber, batchNumber),
        ),
      )
      .orderBy(desc(qt.id));

    const targetRow = rows[0];
    if (!targetRow) return null;

    const status = outcome.passed === true ? 'pass' : 'fail';
    await db
      .update(qt)
      .set({
        status,
        result: outcome.passed === true ? 'pass' : 'fail',
        numericResult: outcome.mean ?? null,
        testedBy: testedById ?? null,
        testDate: dbDate(),
        updatedAt: dbDate(),
      })
      .where(eq(qt.id, targetRow.id));

    return targetRow.id as number;
  });
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
