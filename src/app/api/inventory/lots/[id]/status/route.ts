import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// PUT /api/inventory/lots/[id]/status - Update lot status
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (session) => {
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
      
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      const lotsTable = useSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
      
      // Get existing lot
      const existing = await (db as any)
        .select()
        .from(lotsTable)
        .where(eq(lotsTable.id, lotId))
        .limit(1);
      
      if (existing.length === 0) {
        return notFoundResponse('Lot not found');
      }
      
      const oldLot = existing[0];
      
      // Update status
      await (db as any)
        .update(lotsTable)
        .set({
          status,
          updatedAt: useSqlite ? new Date().toISOString() : new Date(),
        })
        .where(eq(lotsTable.id, lotId));
      
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
      
      return successResponse({ id: lotId, status }, `Lot status updated to ${status}`);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['quality:approve']);
}
