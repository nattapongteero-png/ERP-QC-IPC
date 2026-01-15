/**
 * Work Order Costs API
 * Feature: 014-unit-cost (US3 - Production Cost Aggregation)
 *
 * GET /api/production/work-orders/[id]/costs - Get work order cost summary
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWorkOrderCostSummary,
  getWorkOrderCost,
  calculateWorkOrderCost,
} from '@/lib/services/unit-cost.service';

// GET /api/production/work-orders/[id]/costs - Get work order cost summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      // Check query parameter for full summary vs just costs
      const url = new URL(request.url);
      const fullSummary = url.searchParams.get('summary') === 'true';

      if (fullSummary) {
        // Return detailed cost breakdown with materials and operations
        const summary = await getWorkOrderCostSummary(workOrderId);
        if (!summary) {
          return errorResponse('Work order not found', 404);
        }
        return successResponse(summary);
      }

      // Return just the aggregated costs
      const cost = await getWorkOrderCost(workOrderId);

      // If no stored cost, calculate it on-the-fly
      if (!cost) {
        const calculated = await calculateWorkOrderCost(workOrderId);
        return successResponse({
          ...calculated,
          status: 'calculated',
        });
      }

      return successResponse(cost);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}
