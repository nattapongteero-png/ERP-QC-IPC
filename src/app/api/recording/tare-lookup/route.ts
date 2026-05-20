import { NextRequest } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

// GET /api/recording/tare-lookup?code=IPC-TARE-001
// Returns latest submitted round's mean value + metadata, used by Multi-Point
// record page to auto-subtract Gross − Tare. Returns null when no submitted
// round exists yet — caller renders an amber warning banner.
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const code = searchParams.get('code');
      if (!code) return errorResponse('code is required');

      const criteria = getTableRef('iPCCriteria');
      const rounds = getTableRef('iPCRecordingRounds');

      const [crit] = await executeDbOperation(async (db) => {
        return db.select().from(criteria).where(eq(criteria.code, code));
      });
      if (!crit) return successResponse(null, 'criteria not found');

      const [latest] = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(rounds)
          .where(and(eq(rounds.criteriaId, crit.id), isNotNull(rounds.submittedAt)))
          .orderBy(desc(rounds.submittedAt))
          .limit(1);
      });
      if (!latest) {
        return successResponse({ criteria: crit, latestRound: null, mean: null });
      }

      // Compute mean of values from the round's data payload.
      let mean: number | null = latest.computedMean != null ? Number(latest.computedMean) : null;
      if (mean == null) {
        try {
          const data = JSON.parse(latest.data || '{}');
          const points = Array.isArray(data.points)
            ? data.points.map(Number).filter(Number.isFinite)
            : [];
          if (points.length > 0) mean = points.reduce((a: number, b: number) => a + b, 0) / points.length;
          else if (Number.isFinite(Number(data.value))) mean = Number(data.value);
        } catch {
          mean = null;
        }
      }

      return successResponse({ criteria: crit, latestRound: latest, mean });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}
