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

// POST /api/recording/rounds/:id/verify
//
// Triple Independence: a SECOND qualified person reviews the locked round and
// records verification. The verifier MUST differ from the operator who submitted
// the round (and from whoever started it) — this mirrors the dual-sign control
// legacy IPC tests have via separate record + approve steps.
//
// Pre-conditions:
//   - round is submitted (locked)
//   - not already verified
//   - session.userId !== submittedById  (and !== startedById)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const roundId = Number(id);
      if (!Number.isFinite(roundId)) return errorResponse('Invalid id');

      const rounds = getTableRef(ROUNDS_TABLE);

      const [round] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      if (!round) return errorResponse('Round not found', 404);
      if (!round.submittedAt) return errorResponse('Round not submitted yet', 409);
      if (round.verifiedAt) return errorResponse('Round already verified', 409);

      // Triple Independence — verifier must not be the submitter or starter.
      if (round.submittedById != null && round.submittedById === session.userId) {
        return errorResponse('ผู้ตรวจสอบต้องเป็นคนละคนกับผู้บันทึกผล (Triple Independence)', 403);
      }
      if (round.startedById != null && round.startedById === session.userId) {
        return errorResponse('ผู้ตรวจสอบต้องเป็นคนละคนกับผู้เริ่มบันทึก (Triple Independence)', 403);
      }

      await executeDbOperation(async (db) => {
        return db
          .update(rounds)
          .set({
            verifiedAt: dbDate(),
            verifiedById: session.userId ?? null,
          })
          .where(eq(rounds.id, roundId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'ipc_recording_rounds',
        recordId: roundId,
        newValue: { verified: true, verifiedById: session.userId },
        ipAddress: getClientIP(request),
      });

      const [updated] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      return successResponse(updated, 'Round verified');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
