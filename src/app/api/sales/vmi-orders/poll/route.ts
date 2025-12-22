/**
 * VMI Orders Scheduled Poll API Route
 *
 * POST - Scheduled polling for new orders (called by cron)
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { headers } from 'next/headers';

/**
 * POST /api/sales/vmi-orders/poll
 * Scheduled order polling endpoint (for cron jobs)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for scheduled calls
    const headersList = await headers();
    const cronSecret = headersList.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Allow if:
    // 1. CRON_SECRET is not set (development mode)
    // 2. CRON_SECRET matches
    // 3. Request is from localhost (internal call)
    const isAuthorized =
      !expectedSecret ||
      cronSecret === expectedSecret ||
      request.headers.get('host')?.includes('localhost');

    if (!isAuthorized) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
      }, { status: 401 });
    }

    const service = new VmiSalesOrderService();
    const result = await service.pollOrders();

    // Log for cron monitoring
    console.log('[VMI Order Poll] Scheduled poll completed:', {
      portalsPolled: result.portalsPolled,
      totalNewOrders: result.ordersReceived,
      portalsWithErrors: result.errors?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        result,
        summary: {
          portalsPolled: result.portalsPolled,
          totalNewOrders: result.ordersReceived,
          portalsWithErrors: result.errors?.length || 0,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('[VMI Order Poll] Scheduled poll failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Scheduled poll failed',
    }, { status: 500 });
  }
}
