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
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteItems,
  mysqlItems,
  sqliteVmiSalesOrderLines,
  mysqlVmiSalesOrderLines,
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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

    // Get database and schema tables
    const db = await getDb();
    const usingSqlite = isSqlite();
    const items = usingSqlite ? sqliteItems : mysqlItems;
    const vmiSalesOrderLines = usingSqlite ? sqliteVmiSalesOrderLines : mysqlVmiSalesOrderLines;

    // Verify item exists
    const [item] = await (db as any)
      .select()
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1);

    if (!item) {
      return NextResponse.json({
        success: false,
        error: 'Item not found',
      }, { status: 404 });
    }

    // Update the line with the matched item
    await (db as any)
      .update(vmiSalesOrderLines)
      .set({
        itemId: data.itemId,
        matchStatus: 'matched',
      })
      .where(eq(vmiSalesOrderLines.id, lineIdNum));

    // Get updated order
    const updatedOrder = await service.getOrderById(orderIdNum);

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderIdNum,
        lineId: lineIdNum,
        matchedItemId: data.itemId,
        matchedItemCode: item.code,
        matchedItemName: item.nameTh || item.nameEn,
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

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to match order line',
    }, { status: 500 });
  }
}
