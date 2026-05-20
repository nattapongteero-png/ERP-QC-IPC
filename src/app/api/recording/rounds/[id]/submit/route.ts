import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, dbDate } from '@/lib/db/db-helper';
import { createAuditLog, getClientIP } from '@/lib/audit';

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
      const outcome = computeOutcome(crit, parsedData);

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

      const [updated] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      return successResponse(updated, 'Round submitted');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

// Server-side outcome computation. Trust must not depend on client.
function computeOutcome(
  crit: Record<string, unknown>,
  data: Record<string, unknown>,
): { passed: boolean | null; mean: number | null; note: string } {
  const type = String(crit.criteriaType ?? 'numeric');

  if (type === 'numeric' || type === 'tare') {
    const raw = data.value;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { passed: null, mean: null, note: 'no value' };
    const min = numOrNull(crit.minValue);
    const max = numOrNull(crit.maxValue);
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

  if (type === 'multi_point') {
    const points = Array.isArray(data.points) ? data.points : [];
    const nums = points
      .map((p) => Number(p))
      .filter((n): n is number => Number.isFinite(n));
    if (nums.length === 0) return { passed: null, mean: null, note: 'empty' };
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
    return { passed: null, mean, note: `mean of ${nums.length} points` };
  }

  // Calibration / Calculated / Custom-multi-field: rely on client-side
  // computation for now; server records value but does not re-derive pass/fail.
  if (type === 'calibration' || type === 'calculated' || type === 'custom_multi_field') {
    return { passed: null, mean: null, note: `${type} recorded (client-evaluated)` };
  }

  return { passed: null, mean: null, note: 'unknown type' };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
