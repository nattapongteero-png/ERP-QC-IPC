/**
 * VMI Order Reject API Route (list item 11)
 *
 * POST - Reject a pending VMI order. The factory declines a rush order it cannot
 * fulfil; the reason is recorded and pushed back to the portal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { VmiSalesOrderService, VmiSalesOrderError } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const rejectOrderSchema = z.object({
  reason: z.string().min(1, 'ต้องระบุเหตุผลในการปฏิเสธคำสั่งซื้อ'),
});

/**
 * POST /api/sales/vmi-orders/[orderId]/reject
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { orderId } = await context.params;
      const id = parseInt(orderId, 10);
      if (isNaN(id)) {
        return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
      }

      const body = await request.json();
      const data = rejectOrderSchema.parse(body);

      const service = new VmiSalesOrderService();
      const result = await service.rejectOrder(id, data.reason, session.userId);

      return NextResponse.json({
        success: true,
        data: {
          vmiOrderId: id,
          status: result.vmiOrder.localStatus,
          message: result.message,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { success: false, error: error.issues[0]?.message || 'Invalid request body' },
          { status: 400 },
        );
      }
      if (error instanceof VmiSalesOrderError) {
        return NextResponse.json({ success: false, error: error.message }, { status: error.httpStatus });
      }
      console.error('Failed to reject VMI order:', error);
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to reject VMI order' },
        { status: 500 },
      );
    }
  });
}
