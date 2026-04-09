import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOEnvironmentalLogs,
  createWOEnvironmentalLog,
  updateWOEnvironmentalLog,
  deleteWOEnvironmentalLog,
  validateEnvironmentalReading,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation } from '@/lib/db/db-helper';
import { isSqlite } from '@/lib/db';
import { sqliteWorkOrders, mysqlWorkOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Valid phases for environmental monitoring
const VALID_PHASES = ['pre_production', 'production', 'packaging'];

// External API Key for IoT/sensor integration
const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';

/** Validate X-API-Key header for external callers */
function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

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
// Supports both JWT session (internal) and X-API-Key header (external sensor/IoT)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isExternal = validateApiKey(request);

  // Core handler shared by both auth paths
  const handlePost = async (operatorUserId: number): Promise<NextResponse> => {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // Use provided operatorId, or fallback to the authenticated user
      const operatorId = data.operatorId || operatorUserId;

      // Create the log
      const log = await createWOEnvironmentalLog({
        workOrderId,
        bomConditionId: validation.bomConditionId,
        roomId: data.roomId,
        phase: data.phase,
        recordedDate: data.recordedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }),
        recordedTime: data.recordedTime || new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }),
        temperature: data.temperature,
        humidity: data.humidity,
        isNormal: validation.isNormal,
        operatorId,
        notes: data.notes || (isExternal ? 'Auto-recorded by sensor' : undefined),
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
  };

  // External: API Key auth (no JWT session needed)
  if (isExternal) {
    // Use userId=1 (System Administrator) as default operator for sensor data
    return handlePost(1);
  }

  // Internal: JWT session auth (existing behavior)
  return withAuth(request, async (session) => {
    return handlePost(session.userId);
  });
}

// PUT /api/production/work-orders/[id]/environmental-logs - Update environmental log
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const data = await request.json();
      if (!data.logId) return errorResponse('Missing logId');

      // Re-validate if temperature/humidity changed
      let isNormal = data.isNormal;
      if (data.temperature !== undefined || data.humidity !== undefined) {
        const workOrder = await executeDbOperation(async (db: any) => {
          const table = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
          const orders = await db.select().from(table).where(eq(table.id, workOrderId));
          return orders[0];
        });

        if (workOrder?.bomId && data.phase) {
          const validation = await validateEnvironmentalReading(
            workOrder.bomId, data.phase,
            data.temperature, data.humidity
          );
          isNormal = validation.isNormal;
        }
      }

      const log = await updateWOEnvironmentalLog(data.logId, {
        roomId: data.roomId,
        temperature: data.temperature,
        humidity: data.humidity,
        isNormal,
        notes: data.notes,
      });

      return successResponse(log, 'Environmental log updated');
    } catch (error) {
      console.error('Error updating environmental log:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/work-orders/[id]/environmental-logs - Delete environmental log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const { searchParams } = new URL(request.url);
      const logId = searchParams.get('logId');
      if (!logId) return errorResponse('Missing logId parameter');

      await deleteWOEnvironmentalLog(Number(logId));
      return successResponse(null, 'Environmental log deleted');
    } catch (error) {
      console.error('Error deleting environmental log:', error);
      return serverErrorResponse(error);
    }
  });
}
