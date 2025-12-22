/**
 * Recall Distribution API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id/distribution - Get distribution data for recall
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDistributionData, getRecallById } from '@/lib/services/recall-service';

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

        const distribution = await getDistributionData(recallId);

        return successResponse(distribution);
      } catch (error) {
        console.error('Error getting distribution data:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:read']
  );
}
