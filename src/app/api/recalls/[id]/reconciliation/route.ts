/**
 * Recall Reconciliation API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id/reconciliation - Get reconciliation records
 * POST /api/recalls/:id/reconciliation - Record reconciliation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getRecallReconciliation,
  recordReconciliation,
  getRecallById,
} from '@/lib/services/recall-service';
import { recallReconciliationCreateSchema } from '@/lib/validation/recalls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const recallId = parseInt(id, 10);

        if (isNaN(recallId)) {
          return errorResponse('Invalid recall ID', 400);
        }

        const recall = await getRecallById(recallId);
        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        const reconciliation = await getRecallReconciliation(recallId);

        return successResponse(reconciliation);
      } catch (error) {
        console.error('Error getting reconciliation:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:read']
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const recallId = parseInt(id, 10);

        if (isNaN(recallId)) {
          return errorResponse('Invalid recall ID', 400);
        }

        const recall = await getRecallById(recallId);
        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        const body = await request.json();
        const validatedData = recallReconciliationCreateSchema.parse(body);

        const reconciliation = await recordReconciliation(recallId, validatedData, session.userId);

        return NextResponse.json({ success: true, data: reconciliation }, { status: 201 });
      } catch (error) {
        console.error('Error recording reconciliation:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:execute']
  );
}
