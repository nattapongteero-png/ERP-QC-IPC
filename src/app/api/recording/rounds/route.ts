import { NextRequest } from 'next/server';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, getInsertId, dbDate } from '@/lib/db/db-helper';
import { createAuditLog, getClientIP } from '@/lib/audit';

const ROUNDS_TABLE = 'iPCRecordingRounds';

// GET /api/recording/rounds
//   ?criteriaId=&batchNumber=&submitted=true|false
// Returns rounds filtered + sorted by criteriaId, roundNumber.
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const criteriaIdRaw = searchParams.get('criteriaId');
      const batchNumber = searchParams.get('batchNumber') ?? '';
      const submittedFlag = searchParams.get('submitted'); // 'true' | 'false' | null

      const rounds = getTableRef(ROUNDS_TABLE);

      const conditions: unknown[] = [];
      if (criteriaIdRaw) conditions.push(eq(rounds.criteriaId, Number(criteriaIdRaw)));
      if (batchNumber) conditions.push(eq(rounds.batchNumber, batchNumber));
      if (submittedFlag === 'true') {
        conditions.push(isNotNull(rounds.submittedAt));
      } else if (submittedFlag === 'false') {
        conditions.push(sql`${rounds.submittedAt} IS NULL`);
      }

      const rows = await executeDbOperation(async (db) => {
        let q = db.select().from(rounds);
        if (conditions.length > 0) q = q.where(and(...(conditions as Parameters<typeof and>)));
        return q.orderBy(rounds.criteriaId, rounds.roundNumber);
      });

      return successResponse(rows);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/recording/rounds
// Body: { criteriaId, batchNumber?, reason? }
// Creates a new in-progress round. roundNumber auto-computed by counting
// existing rows for (criteriaId, batchNumber) and adding 1.
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const criteriaId = Number(body.criteriaId);
      const batchNumber = String(body.batchNumber ?? '');
      const reason = body.reason ? String(body.reason) : null;

      if (!Number.isFinite(criteriaId) || criteriaId <= 0) {
        return errorResponse('criteriaId is required');
      }

      const rounds = getTableRef(ROUNDS_TABLE);

      // Compute next roundNumber for this (criteria, batch)
      const existing = await executeDbOperation(async (db) => {
        return db
          .select({ rn: rounds.roundNumber })
          .from(rounds)
          .where(and(eq(rounds.criteriaId, criteriaId), eq(rounds.batchNumber, batchNumber)))
          .orderBy(desc(rounds.roundNumber))
          .limit(1);
      });
      const nextRound = existing.length > 0 ? Number(existing[0].rn) + 1 : 1;

      const result = await executeDbOperation(async (db) => {
        return db.insert(rounds).values({
          criteriaId,
          batchNumber,
          roundNumber: nextRound,
          reason,
          data: '{}',
          startedAt: dbDate(),
          startedById: session.userId,
        });
      });

      const id = getInsertId(result);
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'ipc_recording_rounds',
        recordId: id,
        newValue: { criteriaId, batchNumber, roundNumber: nextRound, reason },
        ipAddress: getClientIP(request),
      });

      const [created] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, id));
      });
      return successResponse(created, `Round ${nextRound} created`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
