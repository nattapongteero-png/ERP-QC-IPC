import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOPackagingWeightLogs,
  createWOPackagingWeightLog,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation } from '@/lib/db/db-helper';
import { isSqlite } from '@/lib/db';
import { sqliteWorkOrders, mysqlWorkOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/production/work-orders/[id]/packaging-weight - Get packaging weight logs
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

      const logs = await getWOPackagingWeightLogs(workOrderId);
      return successResponse(logs);
    } catch (error) {
      console.error('Error fetching WO packaging weight logs:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/packaging-weight - Create packaging weight log
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
      if (!data.checkTime || !data.sampleWeights) {
        return errorResponse('Missing required fields: checkTime, sampleWeights');
      }

      // Validate sampleWeights is a valid JSON array
      let weights: number[];
      try {
        weights =
          typeof data.sampleWeights === 'string'
            ? JSON.parse(data.sampleWeights)
            : data.sampleWeights;

        if (!Array.isArray(weights)) {
          throw new Error('sampleWeights must be an array');
        }

        // Validate all values are numbers
        if (!weights.every((w) => typeof w === 'number')) {
          throw new Error('sampleWeights must contain only numbers');
        }
      } catch (e) {
        return errorResponse(`Invalid sampleWeights format: ${(e as Error).message}`);
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

      // Use session user as operator if not specified
      const operatorId = data.operatorId || session.userId;

      const log = await createWOPackagingWeightLog(
        {
          workOrderId,
          bomQCId: data.bomQCId,
          checkTime: data.checkTime,
          sampleWeights: JSON.stringify(weights),
          operatorId,
          notes: data.notes,
        },
        workOrder.bomId
      );

      return successResponse(
        log,
        log.isPass
          ? `Weight check passed (${log.failedCount} failures out of ${weights.length} samples)`
          : `Weight check FAILED (${log.failedCount} failures out of ${weights.length} samples)`
      );
    } catch (error) {
      console.error('Error creating WO packaging weight log:', error);
      return serverErrorResponse(error);
    }
  });
}
