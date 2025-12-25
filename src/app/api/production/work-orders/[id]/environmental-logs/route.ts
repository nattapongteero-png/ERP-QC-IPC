import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOEnvironmentalLogs,
  createWOEnvironmentalLog,
  validateEnvironmentalReading,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation } from '@/lib/db/db-helper';
import { isSqlite } from '@/lib/db';
import { sqliteWorkOrders, mysqlWorkOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Valid phases for environmental monitoring
const VALID_PHASES = ['production', 'packaging'];

// GET /api/production/work-orders/[id]/environmental-logs - Get environmental logs
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
      const phase = searchParams.get('phase') || undefined;

      if (phase && !VALID_PHASES.includes(phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      const logs = await getWOEnvironmentalLogs(workOrderId, phase);
      return successResponse(logs);
    } catch (error) {
      console.error('Error fetching WO environmental logs:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/environmental-logs - Create environmental log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const data = await request.json();

      // Validate required fields
      if (!data.phase || data.temperature === undefined || data.humidity === undefined) {
        return errorResponse('Missing required fields: phase, temperature, humidity');
      }

      if (!VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      // Get work order to find BOM ID
      const workOrder = await executeDbOperation(async (db: any) => {
        const table = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
        const orders = await db.select().from(table).where(eq(table.id, workOrderId));
        return orders[0];
      });

      if (!workOrder) {
        return errorResponse('Work order not found');
      }

      // Validate environmental reading against BOM conditions
      const validation = await validateEnvironmentalReading(
        workOrder.bomId,
        data.phase,
        data.temperature,
        data.humidity
      );

      // Use session user as operator if not specified
      const operatorId = data.operatorId || session.userId;

      // Create the log
      const log = await createWOEnvironmentalLog({
        workOrderId,
        bomConditionId: validation.bomConditionId,
        phase: data.phase,
        recordedDate: data.recordedDate || new Date().toISOString().split('T')[0],
        recordedTime: data.recordedTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
        temperature: data.temperature,
        humidity: data.humidity,
        isNormal: validation.isNormal,
        operatorId,
        notes: data.notes,
      });

      return successResponse(
        { ...log, limits: validation.limits },
        validation.isNormal
          ? 'Environmental log recorded - within normal range'
          : 'Environmental log recorded - OUTSIDE normal range'
      );
    } catch (error) {
      console.error('Error creating WO environmental log:', error);
      return serverErrorResponse(error);
    }
  });
}
