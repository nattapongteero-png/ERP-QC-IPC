import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getGateStatus,
  canStartProduction,
  canCompleteProduction,
  canStartPackaging,
  canCompletePackaging,
  canCloseWorkOrder,
} from '@/lib/services/production-gate.service';

// GET /api/production/work-orders/[id]/gate-status - Get all gate statuses
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const { searchParams } = new URL(request.url);
      const gate = searchParams.get('gate');

      // If specific gate requested, return only that gate
      if (gate) {
        const validGates = [
          'startProduction',
          'completeProduction',
          'startPackaging',
          'completePackaging',
          'closeWorkOrder',
        ];

        if (!validGates.includes(gate)) {
          return errorResponse(`Invalid gate. Must be one of: ${validGates.join(', ')}`);
        }

        let result;
        switch (gate) {
          case 'startProduction':
            result = await canStartProduction(workOrderId);
            break;
          case 'completeProduction':
            result = await canCompleteProduction(workOrderId);
            break;
          case 'startPackaging':
            result = await canStartPackaging(workOrderId);
            break;
          case 'completePackaging':
            result = await canCompletePackaging(workOrderId);
            break;
          case 'closeWorkOrder':
            result = await canCloseWorkOrder(workOrderId);
            break;
        }

        return successResponse(result);
      }

      // Return all gate statuses
      const gateStatus = await getGateStatus(workOrderId);
      return successResponse(gateStatus);
    } catch (error) {
      console.error('Error fetching gate status:', error);
      return serverErrorResponse(error);
    }
  });
}
