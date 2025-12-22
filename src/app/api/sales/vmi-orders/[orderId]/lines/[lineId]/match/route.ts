/**
 * VMI Order Line Match API Route
 *
 * POST - Manually match an order line to a local item
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const matchLineSchema = z.object({
  itemId: z.number(),
  userId: z.number(),
});

/**
 * POST /api/sales/vmi-orders/[orderId]/lines/[lineId]/match
 * Manually match an order line to a local item
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string; lineId: string }> }
) {
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
    if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `Cannot modify order with status '${order.status}'. Only pending orders can be edited.`,
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

    // Verify item exists
    const { useSqlite, db, sqliteDb } = await import('@/lib/db');
    const { sqliteItems, mysqlItems, sqliteVmiSalesOrderLines, mysqlVmiSalesOrderLines } = await import('@/lib/db/schema');
    const { eq } = await import('drizzle-orm');

    let item;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useSqlite()) {
      const items = await sqliteDb
        .select()
        .from(sqliteItems)
        .where(eq(sqliteItems.id, data.itemId))
        .limit(1);
      item = items[0];
    } else {
      const items = await db
        .select()
        .from(mysqlItems)
        .where(eq(mysqlItems.id, data.itemId))
        .limit(1);
      item = items[0];
    }

    if (!item) {
      return NextResponse.json({
        success: false,
        error: 'Item not found',
      }, { status: 404 });
    }

    // Update the line with the matched item
    // eslint-disable-next-line react-hooks/rules-of-hooks
    if (useSqlite()) {
      await sqliteDb
        .update(sqliteVmiSalesOrderLines)
        .set({
          matchedItemId: data.itemId,
          matchMethod: 'manual',
          unitPrice: item.sellingPrice,
          lineTotal: item.sellingPrice ? item.sellingPrice * line.quantity : null,
        })
        .where(eq(sqliteVmiSalesOrderLines.id, lineIdNum));
    } else {
      await db
        .update(mysqlVmiSalesOrderLines)
        .set({
          matchedItemId: data.itemId,
          matchMethod: 'manual',
          unitPrice: item.sellingPrice ? String(item.sellingPrice) : null,
          lineTotal: item.sellingPrice ? String(Number(item.sellingPrice) * line.quantity) : null,
        })
        .where(eq(mysqlVmiSalesOrderLines.id, lineIdNum));
    }

    // Get updated order
    const updatedOrder = await service.getOrderById(orderIdNum);

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderIdNum,
        lineId: lineIdNum,
        matchedItemId: data.itemId,
        matchedItemCode: item.code,
        matchedItemName: item.name,
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
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to match order line',
    }, { status: 500 });
  }
}
