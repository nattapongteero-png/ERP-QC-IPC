/**
 * VMI Order Detail API Routes
 *
 * GET - Get VMI order by ID
 * PUT - Update VMI order
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const updateOrderSchema = z.object({
  customerId: z.number().int().positive().optional(),
  localStatus: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
});

/**
 * GET /api/sales/vmi-orders/[orderId]
 * Get VMI order details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const id = parseInt(orderId, 10);

    if (isNaN(id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid order ID',
      }, { status: 400 });
    }

    const service = new VmiSalesOrderService();
    const order = await service.getOrderById(id);

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Failed to get VMI order:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get VMI order',
    }, { status: 500 });
  }
}

/**
 * PUT /api/sales/vmi-orders/[orderId]
 * Update VMI order
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
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
    const data = updateOrderSchema.parse(body);

    const service = new VmiSalesOrderService();

    // Verify order exists before update
    const order = await service.getOrderById(id);
    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }

    // Update order via service (only DB-supported fields)
    const updatedOrder = await service.updateOrder(id, {
      customerId: data.customerId,
      localStatus: data.localStatus,
    });

    return NextResponse.json({
      success: true,
      data: updatedOrder,
    });
  } catch (error) {
    console.error('Failed to update VMI order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update VMI order',
    }, { status: 500 });
  }
}
