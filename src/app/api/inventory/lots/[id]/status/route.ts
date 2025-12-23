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
import { recalculateItemOnHand } from '@/lib/services/inventory.service';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/inventory/lots/[id]/status - Update lot status
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const lotId = parseInt(id);

      if (isNaN(lotId)) {
        return errorResponse('Invalid lot ID');
      }

      const body = await request.json();
      const { status, reason } = body;

      const validStatuses = ['quarantine', 'under_test', 'released', 'rejected', 'blocked'];
      if (!status || !validStatuses.includes(status)) {
        return errorResponse(`Status must be one of: ${validStatuses.join(', ')}`);
      }

      const lotsTable = getTableRef('inventoryLots');

      // Get existing lot
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(lotsTable)
          .where(eq(lotsTable.id, lotId))
          .limit(1);
      });

      if (existing.length === 0) {
        return notFoundResponse('Lot not found');
      }

      const oldLot = existing[0];

      // Update status
      await executeDbOperation(async (db) => {
        return db
          .update(lotsTable)
          .set({
            status,
            updatedAt: dbDate(),
          })
          .where(eq(lotsTable.id, lotId));
      });

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: status === 'released' ? 'APPROVE' : status === 'rejected' ? 'REJECT' : 'UPDATE',
        tableName: 'inventory_lots',
        recordId: lotId,
        oldValue: { status: oldLot.status },
        newValue: { status, reason },
        ipAddress: getClientIP(request),
      });

      // Recalculate item onHand if status changed to/from 'released'
      if (status === 'released' || oldLot.status === 'released') {
        await recalculateItemOnHand(oldLot.itemId);
      }

      return successResponse({ id: lotId, status }, `Lot status updated to ${status}`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:approve']);
}
