import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOSOPExecution,
  initializeWOSOPExecution,
  startWOSOPStep,
  completeWOSOPStep,
  verifyWOSOPStep,
  confirmWOSOPSubSteps,
} from '@/lib/services/wo-execution.service';
import { publishWorkOrderChanged } from '@/lib/realtime';
import { executeDbOperation } from '@/lib/db/db-helper';
import { isSqlite } from '@/lib/db';
import { sqliteWorkOrders, mysqlWorkOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/production/work-orders/[id]/sop-execution - Get SOP execution steps
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

      const executions = await getWOSOPExecution(workOrderId);
      return successResponse(executions);
    } catch (error) {
      console.error('Error fetching WO SOP execution:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/sop-execution - Initialize SOP execution from BOM
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

      // Get work order to find BOM ID
      const workOrder = await executeDbOperation(async (db: any) => {
        const table = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
        const orders = await db.select().from(table).where(eq(table.id, workOrderId));
        return orders[0];
      });

      if (!workOrder) {
        return errorResponse('Work order not found');
      }

      // Check if already initialized
      const existing = await getWOSOPExecution(workOrderId);
      if (existing.length > 0) {
        return errorResponse('SOP execution already initialized for this work order');
      }

      // Initialize SOP execution from BOM
      const executions = await initializeWOSOPExecution(workOrderId, workOrder.bomId);
      publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'init');
      return successResponse(executions, 'SOP execution initialized from BOM');
    } catch (error) {
      console.error('Error initializing WO SOP execution:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/work-orders/[id]/sop-execution - Start or complete a step
export async function PUT(
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

      if (!data.executionId || !data.action) {
        return errorResponse('Missing required fields: executionId, action');
      }

      const validActions = ['start', 'complete', 'confirm_substeps'];
      if (!validActions.includes(data.action)) {
        return errorResponse(`Invalid action. Must be one of: ${validActions.join(', ')}`);
      }

      // Use session user as operator if not specified
      const operatorId = data.operatorId || session.userId;

      let execution;
      if (data.action === 'confirm_substeps') {
        if (!Array.isArray(data.confirmedSubStepIds)) {
          return errorResponse('confirmedSubStepIds array is required');
        }
        execution = await confirmWOSOPSubSteps(data.executionId, data.confirmedSubStepIds);
        publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'confirm_substeps');
        return successResponse(execution, 'Sub-steps confirmed');
      } else if (data.action === 'start') {
        execution = await startWOSOPStep(data.executionId, operatorId);
        publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'start');
        return successResponse(execution, 'Step started');
      } else {
        // Validate parameters JSON if provided
        if (data.actualParameters) {
          try {
            if (typeof data.actualParameters === 'string') {
              JSON.parse(data.actualParameters);
            }
          } catch {
            return errorResponse('Invalid actualParameters JSON format');
          }
        }

        const actualParams =
          typeof data.actualParameters === 'object'
            ? JSON.stringify(data.actualParameters)
            : data.actualParameters;

        execution = await completeWOSOPStep(data.executionId, actualParams, data.notes);
        publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'complete');
        return successResponse(execution, 'Step completed');
      }
    } catch (error) {
      console.error('Error updating WO SOP execution:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/work-orders/[id]/sop-execution - Verify a step
export async function PATCH(
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

      if (!data.executionId) {
        return errorResponse('Missing executionId');
      }

      // Use session user as verifier if not specified
      const verifierId = data.verifierId || session.userId;

      const execution = await verifyWOSOPStep(data.executionId, verifierId);
      publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'verify');
      return successResponse(execution, 'Step verified');
    } catch (error) {
      console.error('Error verifying WO SOP step:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message);
      }
      return serverErrorResponse(error);
    }
  });
}
