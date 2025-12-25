/**
 * Recall Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id - Get recall details
 * PATCH /api/recalls/:id - Update recall
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getRecallDetails, updateRecall } from '@/lib/services/recall-service';
import { recallUpdateSchema } from '@/lib/validation/recalls';

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

        const recall = await getRecallDetails(recallId);

        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        return successResponse(recall);
      } catch (error) {
        console.error('Error getting recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:read']
  );
}

export async function PATCH(
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
        const validatedData = recallUpdateSchema.parse(body);

        const recall = await updateRecall(recallId, validatedData, session.userId);

        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        return successResponse(recall);
      } catch (error) {
        console.error('Error updating recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:write']
  );
}
