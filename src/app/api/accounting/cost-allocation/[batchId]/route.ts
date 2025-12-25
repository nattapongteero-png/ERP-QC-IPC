// Cost Allocation - Batch Cost Breakdown API
// Feature: 010-accounting-module-integration
// User Story 4: Process Manufacturing Cost Accounting

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getBatchCostBreakdown } from '@/lib/services/accounting.service';

// GET /api/accounting/cost-allocation/[batchId] - Get batch cost breakdown
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { batchId } = await params;
        const workOrderId = parseInt(batchId, 10);

        if (isNaN(workOrderId) || workOrderId <= 0) {
          return notFoundResponse('Invalid work order ID');
        }

        const breakdown = await getBatchCostBreakdown(workOrderId);

        if (!breakdown) {
          return notFoundResponse('Work order not found');
        }

        return successResponse(breakdown);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:cost_allocation:read']
  );
}
