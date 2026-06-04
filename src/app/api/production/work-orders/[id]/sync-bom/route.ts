import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  initializeWOSOPExecution,
  initializeWOIPCTests,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { publishWorkOrderChanged } from '@/lib/realtime';

/**
 * POST /api/production/work-orders/[id]/sync-bom
 *
 * Idempotently sync execution rows with the current BOM:
 * - Inserts wo_sop_execution rows for any BOM SOP step missing a row
 * - Inserts quality_tests for any BOM IPC criterion missing a test
 * - Backfills quality_tests.ipc_phase where it's NULL
 *
 * Safe to call repeatedly. Operator progress is preserved (no rows deleted
 * or updated except the ipc_phase backfill on rows where it was NULL).
 *
 * Triggered automatically by the Execution Dashboard on mount so a BOM
 * edited after WO initialization stays in sync without manual re-init.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      // Look up bomId for this WO
      const wo = await executeDbOperation(async (db) => {
        const workOrders = getTableRef('workOrders');
        const rows = await db
          .select({ id: workOrders.id, bomId: workOrders.bomId })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId))
          .limit(1);
        return rows[0] || null;
      });

      if (!wo) return errorResponse('Work order not found');
      if (!wo.bomId) {
        return successResponse({ sopInserted: 0, ipcInserted: 0 }, 'Work order has no BOM linked — nothing to sync');
      }

      const sopInserted = await initializeWOSOPExecution(workOrderId, wo.bomId);
      const { created: ipcCreated, rephased: ipcRephased } = await initializeWOIPCTests(
        workOrderId,
        session.userId,
      );

      const sopCount = Array.isArray(sopInserted) ? sopInserted.length : 0;
      const ipcCount = Array.isArray(ipcCreated) ? ipcCreated.length : 0;

      // Notify any open dashboards so they refresh without a manual reload.
      // A phase re-sync (ipcRephased) counts too — the card may move phases
      // even when nothing was newly inserted.
      if (sopCount > 0 || ipcCount > 0 || ipcRephased > 0) {
        try {
          publishWorkOrderChanged(workOrderId, 'status', session.userId, 'sync-bom');
        } catch {
          // Realtime delivery failure must never block the sync response.
        }
      }

      return successResponse({
        sopInserted: sopCount,
        ipcInserted: ipcCount,
        ipcRephased,
      });
    } catch (error) {
      console.error('Error syncing WO from BOM:', error);
      return serverErrorResponse(error);
    }
  });
}
