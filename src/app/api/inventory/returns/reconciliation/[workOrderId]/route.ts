/**
 * Material Returns — reconciliation report per work order.
 *   GET /api/inventory/returns/reconciliation/[workOrderId]
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getMaterialReconciliation } from '@/lib/services/material-return.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workOrderId: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { workOrderId } = await params;
      const woId = Number(workOrderId);
      if (!Number.isFinite(woId)) {
        return errorResponse('Invalid workOrderId');
      }

      const result = await getMaterialReconciliation(woId);
      return successResponse(result);
    } catch (error) {
      console.error('Error computing material reconciliation:', error);
      return serverErrorResponse(error);
    }
  });
}
