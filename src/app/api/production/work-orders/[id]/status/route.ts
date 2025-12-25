import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ['released', 'cancelled'],
  released: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// PUT /api/production/work-orders/[id]/status
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { status, actualQuantity, yieldPercentage, notes } = body;

      const validStatuses = ['planned', 'released', 'in_progress', 'completed', 'cancelled'];
      if (!status || !validStatuses.includes(status)) {
        return errorResponse(`Status must be one of: ${validStatuses.join(', ')}`);
      }

      const workOrdersTable = getTableRef('workOrders');

      // Get existing work order
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Work order not found');
      }

      const oldWO = existing[0];

      // Validate status transition
      const allowedTransitions = STATUS_TRANSITIONS[oldWO.status] || [];
      if (!allowedTransitions.includes(status)) {
        return errorResponse(`Cannot change status from '${oldWO.status}' to '${status}'`);
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: dbDate(),
      };

      // Set timestamps based on status
      if (status === 'in_progress' && !oldWO.actualStartDate) {
        updateData.actualStartDate = dbDate();
      }
      if (status === 'completed') {
        updateData.actualEndDate = dbDate();
        if (actualQuantity !== undefined) {
          updateData.actualQuantity = actualQuantity;
        }
        if (yieldPercentage !== undefined) {
          updateData.yieldPercentage = yieldPercentage;
        }
      }
      if (notes) {
        updateData.notes = notes;
      }

      // Update work order
      await executeDbOperation(async (db) => {
        return db
          .update(workOrdersTable)
          .set(updateData)
          .where(eq(workOrdersTable.id, workOrderId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: status === 'released' ? 'APPROVE' : 'UPDATE',
        tableName: 'work_orders',
        recordId: workOrderId,
        oldValue: { status: oldWO.status },
        newValue: { status, actualQuantity, yieldPercentage },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: workOrderId, status }, `Work order status updated to ${status}`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
