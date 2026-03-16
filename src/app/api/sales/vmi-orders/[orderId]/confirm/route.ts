/**
 * VMI Order Confirm API Route
 *
 * POST - Confirm a VMI order (creates sales order)
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const confirmOrderSchema = z.object({
  notes: z.string().optional(),
});

/**
 * POST /api/sales/vmi-orders/[orderId]/confirm
 * Confirm VMI order and create internal sales order
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { orderId } = await context.params;
      const id = parseInt(orderId, 10);

      if (isNaN(id)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid order ID',
        }, { status: 400 });
      }

      const body = await request.json();
      const data = confirmOrderSchema.parse(body);

      const service = new VmiSalesOrderService();

      // Verify order exists
      const order = await service.getOrderById(id);
      if (!order) {
        return NextResponse.json({
          success: false,
          error: 'Order not found',
        }, { status: 404 });
      }

      // Check if order is in a confirmable state
      if (order.localStatus !== 'pending') {
        return NextResponse.json({
          success: false,
          error: `Cannot confirm order with status '${order.localStatus}'. Only pending orders can be confirmed.`,
        }, { status: 400 });
      }

      // Check if all lines are matched
      const unmatchedLines = order.lines?.filter(line => !line.itemId || line.matchStatus === 'unmatched') || [];
      if (unmatchedLines.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Cannot confirm order. ${unmatchedLines.length} line(s) have unmatched items.`,
          details: unmatchedLines.map(line => ({
            lineId: line.id,
            itemCode: line.tppCode || line.localCode || '',
            itemName: line.itemName,
          })),
        }, { status: 400 });
      }

      // Confirm the order
      const result = await service.confirmOrder(id, { userId: session.userId, notes: data.notes });

      return NextResponse.json({
        success: true,
        data: {
          vmiOrderId: id,
          salesOrderId: result.salesOrder.id,
          salesOrderNumber: result.salesOrder.soNumber,
          message: result.message || 'Order confirmed successfully',
        },
      });
    } catch (error) {
      console.error('Failed to confirm VMI order:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json({
          success: false,
          error: 'Invalid request body',
          details: error.issues,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to confirm VMI order',
      }, { status: 500 });
    }
  });
}
