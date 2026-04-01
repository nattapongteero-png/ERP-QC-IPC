import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOIPCTests,
  initializeWOIPCTests,
  recordIPCTestResult,
  approveIPCTest,
  getBOMIPCConfig,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/production/work-orders/[id]/ipc - Get IPC tests for a work order
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
      const action = searchParams.get('action');

      // Return BOM IPC config if requested
      if (action === 'bom-config') {
        const workOrders = getTableRef('workOrders');
        const wo = await executeDbOperation(async (db) => {
          const result = await db
            .select({ bomId: workOrders.bomId })
            .from(workOrders)
            .where(eq(workOrders.id, workOrderId));
          return result[0];
        });

        if (!wo?.bomId) {
          return successResponse([], 'No BOM linked to this work order');
        }

        const config = await getBOMIPCConfig(wo.bomId);
        return successResponse(config);
      }

      // Default: return IPC tests with samples
      const tests = await getWOIPCTests(workOrderId);
      return successResponse(tests);
    } catch (error) {
      console.error('Error fetching IPC tests:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/ipc - Initialize or record IPC tests
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
      const action = data.action;

      // Action: Initialize IPC tests from BOM config
      if (action === 'initialize') {
        const created = await initializeWOIPCTests(workOrderId, session.userId);

        await createAuditLog({
          userId: session.userId,
          action: 'CREATE',
          tableName: 'quality_tests',
          recordId: workOrderId,
          newValue: { action: 'initialize_ipc', count: created.length },
          ipAddress: getClientIP(request),
        });

        return successResponse(created, `Initialized ${created.length} IPC tests from BOM`);
      }

      // Action: Record test result
      if (action === 'record') {
        if (!data.qualityTestId) {
          return errorResponse('Missing qualityTestId');
        }

        const result = await recordIPCTestResult({
          qualityTestId: data.qualityTestId,
          numericResult: data.numericResult,
          result: data.result,
          notes: data.notes,
          testedBy: session.userId,
          samples: data.samples,
        });

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'quality_tests',
          recordId: data.qualityTestId,
          newValue: { action: 'record_ipc', result: result.status },
          ipAddress: getClientIP(request),
        });

        return successResponse(result, 'IPC test result recorded');
      }

      // Action: Approve test
      if (action === 'approve') {
        if (!data.qualityTestId) {
          return errorResponse('Missing qualityTestId');
        }

        const result = await approveIPCTest(
          data.qualityTestId,
          session.userId,
          data.disposition || 'accept'
        );

        await createAuditLog({
          userId: session.userId,
          action: 'UPDATE',
          tableName: 'quality_tests',
          recordId: data.qualityTestId,
          newValue: { action: 'approve_ipc', disposition: data.disposition },
          ipAddress: getClientIP(request),
        });

        return successResponse(result, 'IPC test approved');
      }

      return errorResponse('Invalid action. Use: initialize, record, approve');
    } catch (error) {
      console.error('Error in IPC operation:', error);
      return serverErrorResponse(error);
    }
  }, ['production:write', 'quality:write']);
}
