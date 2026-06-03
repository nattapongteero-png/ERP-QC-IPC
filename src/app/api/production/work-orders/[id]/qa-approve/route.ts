/**
 * eBMR audit gap #6 — QA approval signature on the eBMR / batch record.
 *
 * Captures the explicit "Approved By (QA)" signature on the work order so
 * the printed eBMR carries a real name+timestamp instead of a blank line.
 *
 * Triple Independence:
 * - QA approver MUST be a different user from the Producer (workOrders.completedBy)
 * - QA approver MUST be a different user from the QC verifier (latest
 *   wo_finished_inspection / quality_tests.approvedBy on this WO)
 */
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { publishWorkOrderChanged } from '@/lib/realtime';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (Number.isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }
      const data = await request.json().catch(() => ({}));
      const notes = typeof data?.notes === 'string' ? data.notes : null;

      const workOrders = getTableRef('workOrders');

      const [wo] = await executeDbOperation(async (db: any) => {
        return db
          .select({
            id: workOrders.id,
            status: workOrders.status,
            completedBy: workOrders.completedBy,
            qaApprovedBy: workOrders.qaApprovedBy,
          })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
      });
      if (!wo) return errorResponse('Work order not found', 404);

      if (wo.qaApprovedBy) {
        return errorResponse('WO ถูก QA approve ไปแล้ว', 409);
      }
      if (!['completed', 'closed'].includes(wo.status)) {
        return errorResponse(
          'QA approve ได้เฉพาะ WO ที่อยู่ในสถานะ completed หรือ closed',
          400,
        );
      }
      // Triple Independence — QA ≠ Producer
      if (wo.completedBy && Number(wo.completedBy) === session.userId) {
        return errorResponse(
          'Approved By (QA) ต้องเป็นคนละคนกับ Produced By — GMP independent check',
          409,
        );
      }
      // Triple Independence — QA ≠ QC verifier (finished inspection)
      try {
        const woFinishedInspection = getTableRef('wOFinishedInspection');
        const inspections = await executeDbOperation(async (db: any) => {
          return db
            .select({
              inspectorId: woFinishedInspection.inspectorId,
              reInspectorId: woFinishedInspection.reInspectorId,
              status: woFinishedInspection.status,
            })
            .from(woFinishedInspection)
            .where(eq(woFinishedInspection.workOrderId, workOrderId));
        });
        const passed = inspections.find((i: { status?: string }) => i.status === 'passed');
        if (passed) {
          const qcUser = passed.reInspectorId ?? passed.inspectorId;
          if (qcUser && Number(qcUser) === session.userId) {
            return errorResponse(
              'Approved By (QA) ต้องเป็นคนละคนกับ Verified By (QC) — GMP independent check',
              409,
            );
          }
        }
      } catch {
        /* table may not exist on older setups */
      }

      await executeDbOperation(async (db: any) => {
        return db
          .update(workOrders)
          .set({
            qaApprovedBy: session.userId,
            qaApprovedAt: getNow(),
            qaApprovalNotes: notes,
            updatedAt: getNow(),
          })
          .where(eq(workOrders.id, workOrderId));
      });

      publishWorkOrderChanged(workOrderId, 'qa-approve', session.userId, 'sign');
      return successResponse(
        { workOrderId, qaApprovedBy: session.userId },
        'QA approval signed — eBMR is now locked',
      );
    } catch (error) {
      console.error('QA approve error:', error);
      return serverErrorResponse(error);
    }
  }, ['quality:write']);
}
