import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { createAuditLog, getClientIP } from '@/lib/audit';

const ROUNDS_TABLE = 'iPCRecordingRounds';

// GET /api/recording/rounds/:id
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(_request, async () => {
    try {
      const { id } = await params;
      const rounds = getTableRef(ROUNDS_TABLE);
      const [row] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, Number(id)));
      });
      if (!row) return errorResponse('Round not found', 404);
      return successResponse(row);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// PUT /api/recording/rounds/:id
// Body: { data: object | string, reason?: string }
// Updates in-progress round. Blocked if submittedAt is set.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const roundId = Number(id);
      if (!Number.isFinite(roundId)) return errorResponse('Invalid id');

      const body = await request.json();
      const rounds = getTableRef(ROUNDS_TABLE);

      const [existing] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });
      if (!existing) return errorResponse('Round not found', 404);
      if (existing.submittedAt) return errorResponse('Round already submitted — locked', 409);

      const patch: Record<string, unknown> = {};
      if (body.data !== undefined) {
        patch.data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);
      }
      if (body.reason !== undefined) patch.reason = String(body.reason);

      if (Object.keys(patch).length === 0) {
        return successResponse(existing, 'No changes');
      }

      await executeDbOperation(async (db) => {
        return db.update(rounds).set(patch).where(eq(rounds.id, roundId));
      });

      const [updated] = await executeDbOperation(async (db) => {
        return db.select().from(rounds).where(eq(rounds.id, roundId));
      });

      await createAuditLog({
        userId: session.userId,
        action: 'UPDATE',
        tableName: 'ipc_recording_rounds',
        recordId: roundId,
        oldValue: { data: existing.data, reason: existing.reason },
        newValue: patch,
        ipAddress: getClientIP(request),
      });

      return successResponse(updated);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
