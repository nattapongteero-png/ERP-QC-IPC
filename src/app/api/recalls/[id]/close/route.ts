/**
 * Close Recall API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/:id/close - Close recall
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { closeRecall } from '@/lib/services/recall-service';
import { recallCloseSchema } from '@/lib/validation/recalls';

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

        const body = await request.json();
        const validatedData = recallCloseSchema.parse(body);

        const recall = await closeRecall(recallId, validatedData, session.userId);

        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        return successResponse(recall);
      } catch (error) {
        console.error('Error closing recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:close']
  );
}
