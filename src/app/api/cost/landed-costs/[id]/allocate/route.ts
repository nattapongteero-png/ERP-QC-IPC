/**
 * API Route: POST /api/cost/landed-costs/[id]/allocate
 * Allocate landed cost to items based on allocation basis
 * Feature: 014-unit-cost
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { allocateLandedCost } from '@/lib/services/unit-cost.service';

// POST /api/cost/landed-costs/[id]/allocate - Allocate landed cost to items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const landedCostId = parseInt(id, 10);

        if (isNaN(landedCostId)) {
          return errorResponse('Invalid landed cost ID', 400);
        }

        const allocations = await allocateLandedCost(landedCostId);

        return successResponse(
          {
            status: 'allocated',
            totalAllocations: allocations.length,
            allocations,
          },
          'Landed cost allocated successfully'
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (
            error.message.includes('draft status') ||
            error.message.includes('No cost lines') ||
            error.message.includes('No PO lines')
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
