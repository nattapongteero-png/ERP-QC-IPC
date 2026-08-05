/**
 * VMI Order Line Match API Route
 *
 * POST - Manually match an order line to a local item
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { VmiSalesOrderService, VmiSalesOrderError } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const matchLineSchema = z.object({
  itemId: z.number(),
});

/**
 * POST /api/sales/vmi-orders/[orderId]/lines/[lineId]/match
 * Manually match an order line to a local item
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string; lineId: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { orderId, lineId } = await context.params;
      const orderIdNum = parseInt(orderId, 10);
      const lineIdNum = parseInt(lineId, 10);

      if (isNaN(orderIdNum) || isNaN(lineIdNum)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid order ID or line ID',
        }, { status: 400 });
      }

      const body = await request.json();
      const data = matchLineSchema.parse(body);

      const service = new VmiSalesOrderService();

      // Verify order exists
      const order = await service.getOrderById(orderIdNum);
      if (!order) {
        return NextResponse.json({
          success: false,
          error: 'Order not found',
        }, { status: 404 });
      }

      // Check if order is in an editable state
      if (order.localStatus !== 'pending') {
        return NextResponse.json({
          success: false,
          error: `Cannot modify order with status '${order.localStatus}'. Only pending orders can be edited.`,
        }, { status: 400 });
      }

      // Verify line exists
      const line = order.lines?.find(l => l.id === lineIdNum);
      if (!line) {
        return NextResponse.json({
          success: false,
          error: 'Order line not found',
        }, { status: 404 });
      }

      // The service owns the write: it sets the real columns (item_id,
      // local_code, match_status) and writes the audit trail. Matching does NOT
      // touch unit_price / line_total — the VMI Portal is the source of truth
      // for order pricing, and those columns are NOT NULL.
      const updatedLine = await service.matchOrderLine(
        orderIdNum,
        lineIdNum,
        data.itemId,
        session.userId
      );

      // Get updated order
      const updatedOrder = await service.getOrderById(orderIdNum);
      const matchedItem = updatedOrder?.lines?.find(l => l.id === lineIdNum)?.matchedItem;

      return NextResponse.json({
        success: true,
        data: {
          orderId: orderIdNum,
          lineId: lineIdNum,
          matchedItemId: data.itemId,
          matchedItemCode: matchedItem?.code ?? updatedLine.localCode ?? null,
          matchedItemName: matchedItem?.nameTh ?? matchedItem?.nameEn ?? null,
          message: 'Line matched successfully',
          order: updatedOrder,
        },
      });
    } catch (error) {
      console.error('Failed to match order line:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json({
          success: false,
          error: 'Invalid request body',
          details: error.issues,
        }, { status: 400 });
      }

      if (error instanceof VmiSalesOrderError) {
        return NextResponse.json({
          success: false,
          error: error.message,
        }, { status: error.httpStatus });
      }

      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to match order line',
      }, { status: 500 });
    }
  });
}
