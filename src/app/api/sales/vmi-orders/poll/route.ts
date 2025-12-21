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
    const results = await service.pollOrders();

    // Calculate totals
    const totalNew = results.reduce((sum, r) => sum + r.ordersReceived, 0);
    const totalErrors = results.filter(r => r.errors && r.errors.length > 0).length;

    // Log for cron monitoring
    console.log('[VMI Order Poll] Scheduled poll completed:', {
      portalsPolled: results.length,
      totalNewOrders: totalNew,
      portalsWithErrors: totalErrors,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          portalsPolled: results.length,
          totalNewOrders: totalNew,
          portalsWithErrors: totalErrors,
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
