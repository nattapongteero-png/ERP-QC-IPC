/**
 * API Route: POST /api/cost/landed-costs/[id]/post
 * Post landed cost - updates WAC for affected items and creates cost layers
 * Feature: 014-unit-cost
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { postLandedCost, getLandedCost } from '@/lib/services/unit-cost.service';

// POST /api/cost/landed-costs/[id]/post - Post landed cost
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const landedCostId = parseInt(id, 10);

        if (isNaN(landedCostId)) {
          return errorResponse('Invalid landed cost ID', 400);
        }

        await postLandedCost(landedCostId, session.userId);

        // Get updated landed cost for response
        const landedCost = await getLandedCost(landedCostId);

        return successResponse(
          {
            status: 'posted',
            id: landedCostId,
            postedAt: landedCost?.postedAt,
            documentNumber: landedCost?.documentNumber,
          },
          'Landed cost posted successfully'
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (
            error.message.includes('allocated status') ||
            error.message.includes('No allocations')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['cost:write']
  );
}
