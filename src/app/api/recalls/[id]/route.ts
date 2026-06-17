/**
 * Recall Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id - Get recall details
 * PATCH /api/recalls/:id - Update recall
 * DELETE /api/recalls/:id - Delete an initiated recall (guarded)
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getRecallDetails, updateRecall, deleteRecall } from '@/lib/services/recall-service';
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

export async function DELETE(
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

        await deleteRecall(recallId, session.userId);
        return successResponse({ id: recallId }, 'Recall deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Only recalls')) {
            return errorResponse(error.message, 400);
          }
        }
        console.error('Error deleting recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:write']
  );
}
