import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getNow } from '@/lib/db/date-utils';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/production/work-orders/[id]/requisition
// Body: { action: 'request' | 'approve' }
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { action } = body as { action: string };

      if (action !== 'request' && action !== 'approve') {
        return errorResponse("Action must be 'request' or 'approve'");
      }

      const workOrdersTable = getTableRef('workOrders');

      // Fetch existing work order
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (existing.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const wo = existing[0];

      if (action === 'request') {
        // Validate: WO status must be planned, released, or in_progress
        if (!['planned', 'released', 'in_progress'].includes(wo.status as string)) {
          return errorResponse(
            `Cannot request materials for work order with status '${wo.status}'. Status must be 'planned', 'released' or 'in_progress'.`
          );
        }

        // Validate: requisitionStatus must be 'none'
        if (wo.requisitionStatus !== 'none') {
          return errorResponse(
            `Requisition already submitted (current status: '${wo.requisitionStatus}').`
          );
        }

        await executeDbOperation(async (db) => {
          return db
            .update(workOrdersTable)
            .set({
              requisitionStatus: 'requested',
              requisitionRequestedBy: session.userId,
              requisitionRequestedAt: getNow(),
            })
            .where(eq(workOrdersTable.id, workOrderId));
        });

        return successResponse(
          { id: workOrderId, requisitionStatus: 'requested' },
          'Material requisition submitted successfully'
        );
      }

      // action === 'approve'
      // Validate: requisitionStatus must be 'requested'
      if (wo.requisitionStatus !== 'requested') {
        return errorResponse(
          `Cannot approve requisition with status '${wo.requisitionStatus}'. Status must be 'requested'.`
        );
      }

      await executeDbOperation(async (db) => {
        return db
          .update(workOrdersTable)
          .set({
            requisitionStatus: 'approved',
            requisitionApprovedBy: session.userId,
            requisitionApprovedAt: getNow(),
          })
          .where(eq(workOrdersTable.id, workOrderId));
      });

      return successResponse(
        { id: workOrderId, requisitionStatus: 'approved' },
        'Material requisition approved successfully'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
