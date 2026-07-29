/**
 * VMI Order Ship API Route
 *
 * POST - Ship a VMI order (updates shipment details)
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { z } from 'zod';

const shipOrderSchema = z.object({
  userId: z.number(),
  shipmentDate: z.string().default(() => new Date().toISOString()),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * POST /api/sales/vmi-orders/[orderId]/ship
 * Mark VMI order as shipped and notify portal
 */
export async function POST(
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
    const data = shipOrderSchema.parse(body);

    const service = new VmiSalesOrderService();

    // Verify order exists
    const order = await service.getOrderById(id);
    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }

    // Check if order is in a shippable state
    if (order.localStatus !== 'confirmed' && order.localStatus !== 'processing') {
      return NextResponse.json({
        success: false,
        error: `Cannot ship order with status '${order.localStatus}'. Only confirmed or processing orders can be shipped.`,
      }, { status: 400 });
    }

    // Ship the order
    const result = await service.shipOrder(id, {
      shipmentDate: data.shipmentDate,
      expectedDeliveryDate: data.shipmentDate,
      trackingNumber: data.trackingNumber,
      carrier: data.carrier,
      notes: data.notes,
    });

    return NextResponse.json({
      success: true,
      data: {
        vmiOrderId: id,
        // See the confirm route: a portal rejection must not read as success.
        portalSynced: result.portalSynced,
        portalSyncError: result.portalSyncError,
        message: result.message || 'Order shipped successfully',
        order: result.vmiOrder,
      },
    });
  } catch (error) {
    console.error('Failed to ship VMI order:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: error.issues,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to ship VMI order',
    }, { status: 500 });
  }
}
