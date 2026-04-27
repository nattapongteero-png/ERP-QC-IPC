import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getPhaseState } from '@/lib/services/phase-state.service';

/**
 * GET /api/production/work-orders/[id]/phase/status
 *
 * Returns the computed state for the 3 monitored phases of a work order:
 *   - pre_production
 *   - production
 *   - packaging
 *
 * Each phase reports: status (pending|active|completed), startedAt, completedAt,
 * and progress of the activity that gates its completion.
 *
 * Consumed by the Environmental Monitoring page to render per-tab badges
 * and the active-phase banner. No writes — state is derived.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (!Number.isInteger(workOrderId) || workOrderId <= 0) {
        return errorResponse('Invalid work order ID');
      }

      const state = await getPhaseState(workOrderId);
      return successResponse(state);
    } catch (error) {
      console.error('Error computing phase status:', error);
      return serverErrorResponse(error);
    }
  });
}
