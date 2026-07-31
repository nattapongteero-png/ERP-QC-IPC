/**
 * API: POST /api/purchasing/orders/[id]/reject-receipt
 *
 * The warehouse/purchasing officer refuses a delivery at the receive step
 * (failed the receive checklist, wrong/damaged/expired goods). Unlike "receive",
 * this creates NO lot and does NOT change the received quantity — it records the
 * refusal as a QA Deviation so the rejection is traceable and purchasing can
 * chase the vendor. Mirrors the deviation that the later GRN/QA reject writes.
 */
import { NextRequest } from 'next/server';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { eq } from 'drizzle-orm';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);
      if (!Number.isInteger(poId) || poId <= 0) return errorResponse('รหัสใบสั่งซื้อไม่ถูกต้อง');

      const body = await request.json();
      const { lineId, reason, checklist } = body as {
        lineId?: number;
        reason?: string;
        checklist?: Array<{ label: string; passed: boolean }>;
      };
      if (!lineId) return errorResponse('Line ID is required');
      if (!reason || !String(reason).trim()) {
        return errorResponse('กรุณาระบุเหตุผลการปฏิเสธ');
      }

      // Fold any failed checklist items into the deviation so QA sees WHAT failed,
      // not just the free-text reason.
      const failedItems = Array.isArray(checklist)
        ? checklist.filter((c) => c && c.passed === false).map((c) => c.label)
        : [];
      const fullDescription = failedItems.length
        ? `${String(reason).trim()}\n\nChecklist ที่ไม่ผ่าน: ${failedItems.join(' · ')}`
        : String(reason).trim();

      const result = await executeDbOperation(async (db) => {
        const poTable = getTableRef('purchaseOrders');
        const lineTable = getTableRef('purchaseOrderLines');
        const deviationsTable = getTableRef('deviations');

        const [po] = await db
          .select()
          .from(poTable)
          .where(eq((poTable as { id: never }).id, poId))
          .limit(1);
        if (!po) return { error: 'ไม่พบใบสั่งซื้อ' };

        const [line] = await db
          .select()
          .from(lineTable)
          .where(eq((lineTable as { id: never }).id, Number(lineId)))
          .limit(1);
        if (!line) return { error: 'ไม่พบรายการสินค้าในใบสั่งซื้อ' };

        const now = getNow();
        const devNumber = `DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        const devIns = await db.insert(deviationsTable).values({
          deviationNumber: devNumber,
          type: 'incoming_inspection',
          sourceType: 'warehouse',
          sourceId: Number(lineId),
          severity: 'major',
          title: `ปฏิเสธการรับของ (Rejected receipt): PO ${po.poNumber} — ${line.itemCode ?? ''}`,
          description: fullDescription,
          reportedBy: session.userId,
          reportedAt: now,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        });

        return {
          deviationId: getInsertId(devIns),
          deviationNumber: devNumber,
          poNumber: po.poNumber,
          itemCode: line.itemCode ?? null,
        };
      });

      if ('error' in result && result.error) return errorResponse(result.error, 404);

      await createAuditLog({
        userId: session.userId,
        action: 'REJECT',
        tableName: 'purchase_order_lines',
        recordId: Number(lineId),
        newValue: {
          poId,
          reason: String(reason).trim(),
          deviationNumber: (result as { deviationNumber: string }).deviationNumber,
        },
        ipAddress: getClientIP(request),
      });

      return successResponse(result, 'ปฏิเสธการรับและบันทึก Deviation แล้ว');
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
