import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { returnWOPackagingMaterial } from '@/lib/services/wo-execution.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

// POST /api/production/work-orders/[id]/packaging-materials/return
// Return leftover primary-packing material back into the warehouse.
// Creates a new child lot, posts a 'return' inventory transaction, and
// recalculates items.onHand — so stock balance auto-updates.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const data = await request.json();
      if (!data.materialId || data.qtyReturned === undefined) {
        return errorResponse('Missing required fields: materialId, qtyReturned');
      }

      const result = await returnWOPackagingMaterial({
        materialId: Number(data.materialId),
        qtyReturned: Number(data.qtyReturned),
        userId: session.userId,
        reason: data.reason,
      });

      publishWorkOrderChanged(workOrderId, 'packaging-materials', session.userId, 'return');
      return successResponse(result, 'รับคืนวัตถุดิบเข้าคลังเรียบร้อย (Packaging material returned)');
    } catch (error) {
      if (error instanceof Error) {
        const msg = error.message;
        // Business-rule errors should surface as 400, not 500
        const isBusinessError =
          msg.includes('not found') ||
          msg.includes('already returned') ||
          msg.includes('ถูกรับคืน') ||
          msg.includes('มากกว่า') ||
          msg.includes('greater than') ||
          msg.includes('Cannot return') ||
          msg.includes('ไม่สามารถรับคืน');
        if (isBusinessError) return errorResponse(msg, 400);
      }
      console.error('Error returning packaging material:', error);
      return serverErrorResponse(error);
    }
  });
}
