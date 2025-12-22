/**
 * Start Recall API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/:id/start - Start recall execution
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { startRecall } from '@/lib/services/recall-service';

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

        const recall = await startRecall(recallId, session.userId);

        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        return successResponse(recall);
      } catch (error) {
        console.error('Error starting recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:execute']
  );
}
