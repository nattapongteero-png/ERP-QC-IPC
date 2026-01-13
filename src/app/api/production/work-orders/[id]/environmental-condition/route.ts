import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq, and } from 'drizzle-orm';

// Valid phases for environmental monitoring
const VALID_PHASES = ['production', 'packaging'];

// GET /api/production/work-orders/[id]/environmental-condition - Get BOM environmental condition for phase
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
      const phase = searchParams.get('phase');

      if (!phase || !VALID_PHASES.includes(phase)) {
        return errorResponse(`Invalid or missing phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      // Get tables
      const workOrders = getTableRef('workOrders');
      const bomEnvironmentalConditions = getTableRef('bomEnvironmentalConditions');
      const environmentalConditions = getTableRef('environmentalConditions');

      // Get work order's BOM ID
      const workOrder = await executeDbOperation(async (db) => {
        const result = await db
          .select({ bomId: workOrders.bomId })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
        return result[0];
      });

      if (!workOrder) {
        return errorResponse('Work order not found', 404);
      }

      if (!workOrder.bomId) {
        return successResponse(null, 'No BOM linked to this work order');
      }

      // Get BOM environmental condition for this phase
      const condition = await executeDbOperation(async (db) => {
        const result = await db
          .select({
            id: bomEnvironmentalConditions.id,
            bomId: bomEnvironmentalConditions.bomId,
            conditionId: bomEnvironmentalConditions.conditionId,
            phase: bomEnvironmentalConditions.phase,
            // Environmental condition details
            name: environmentalConditions.name,
            temperatureMin: environmentalConditions.temperatureMin,
            temperatureMax: environmentalConditions.temperatureMax,
            humidityMax: environmentalConditions.humidityMax,
            monitoringIntervalMinutes: environmentalConditions.monitoringIntervalMinutes,
          })
          .from(bomEnvironmentalConditions)
          .innerJoin(
            environmentalConditions,
            eq(bomEnvironmentalConditions.conditionId, environmentalConditions.id)
          )
          .where(
            and(
              eq(bomEnvironmentalConditions.bomId, workOrder.bomId),
              eq(bomEnvironmentalConditions.phase, phase)
            )
          );
        return result[0];
      });

      if (!condition) {
        return successResponse(null, `No environmental condition configured for ${phase} phase`);
      }

      return successResponse(condition);
    } catch (error) {
      console.error('Error fetching environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}
