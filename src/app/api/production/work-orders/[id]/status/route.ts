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
import { publishWorkOrderChanged } from '@/lib/realtime';
import {
  canRelease,
  canStartProduction,
  canCompleteProduction,
} from '@/lib/services/production-gate.service';

type RouteParams = { params: Promise<{ id: string }> };

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ['released', 'cancelled'],
  released: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['closed'],
  closed: [],
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

      const validStatuses = ['planned', 'released', 'in_progress', 'completed', 'closed', 'cancelled'];
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

      // Gate validation — check prerequisites for each transition
      if (status !== 'cancelled') {
        let gateResult = null;

        if (status === 'released') {
          gateResult = await canRelease(workOrderId);
        } else if (status === 'in_progress') {
          gateResult = await canStartProduction(workOrderId);
        } else if (status === 'completed') {
          gateResult = await canCompleteProduction(workOrderId);
        }

        if (gateResult && !gateResult.canProceed) {
          const blockerList = gateResult.blockers.map((b, i) => `${i + 1}. ${b}`).join('\n');
          return errorResponse(
            `ไม่สามารถเปลี่ยนสถานะเป็น ${status} ได้ เนื่องจากยังทำขั้นตอนไม่ครบ:\n${blockerList}`
          );
        }
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
        // eBMR "Produced By" signature — capture on completion transition
        updateData.completedBy = session.userId;
        updateData.completedAt = dbDate();
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

      publishWorkOrderChanged(workOrderId, 'status', session.userId, status);

      // Audit QC1/QC4 — notify QC when a WO transitions to 'completed' so
      // Finished Product QC can start. Best-effort: never roll back the
      // status change if the notification dispatch fails.
      if (status === 'completed') {
        try {
          const { notifyWOCompleted } = await import('@/lib/services/qc-notification.service');
          const itemsTable = getTableRef('items');
          const [productMeta] = await executeDbOperation(async (db) => {
            return db
              .select({
                woNumber: workOrdersTable.woNumber,
                batchNumber: workOrdersTable.batchNumber,
                actualQuantity: workOrdersTable.actualQuantity,
                unit: workOrdersTable.unit,
                productId: workOrdersTable.productId,
                productName: itemsTable.nameTh,
              })
              .from(workOrdersTable)
              .leftJoin(itemsTable, eq(workOrdersTable.productId, itemsTable.id))
              .where(eq(workOrdersTable.id, workOrderId));
          });
          if (productMeta) {
            await notifyWOCompleted({
              workOrderId,
              woNumber: productMeta.woNumber as string,
              batchNumber: (productMeta.batchNumber as string) ?? null,
              productName: productMeta.productName as string | null,
              actualQuantity:
                productMeta.actualQuantity != null
                  ? Number(productMeta.actualQuantity)
                  : null,
              unit: (productMeta.unit as string) ?? null,
            });
          }
        } catch (err) {
          console.warn('QC WO-completed notification failed (non-fatal):', err);
        }

        // QC Flow item 1 — auto-create a finished-goods QC sample so QC has a
        // testing entry ready (no manual creation). Tests are seeded from the
        // product's default panel. No stock draw here (the FG lot is created
        // later at goods-receipt of the WO output). Best-effort.
        try {
          const { createQcSample } = await import('@/lib/services/qc-sample.service');
          const productMeta = await executeDbOperation(async (db) => {
            const [row] = await db
              .select({
                woNumber: workOrdersTable.woNumber,
                batchNumber: workOrdersTable.batchNumber,
                actualQuantity: workOrdersTable.actualQuantity,
                unit: workOrdersTable.unit,
                productId: workOrdersTable.productId,
              })
              .from(workOrdersTable)
              .where(eq(workOrdersTable.id, workOrderId));
            return row;
          });
          if (productMeta?.productId) {
            await createQcSample({
              productId: Number(productMeta.productId),
              sourceType: 'work_order_batch',
              sourceRefId: workOrderId,
              sourceRefText: `WO ${productMeta.woNumber}`,
              lotNumber: (productMeta.batchNumber as string) ?? null,
              quantityReceived:
                productMeta.actualQuantity != null ? Number(productMeta.actualQuantity) : null,
              unit: (productMeta.unit as string) ?? null,
              receivedDate: new Date().toISOString().slice(0, 10),
              receivedBy: session.userId,
              applyDefaultPanel: true,
            });
          }
        } catch (err) {
          console.warn('QC WO-completed auto-sample failed (non-fatal):', err);
        }
      }

      return successResponse({ id: workOrderId, status }, `Work order status updated to ${status}`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
