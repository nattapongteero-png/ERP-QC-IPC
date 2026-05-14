/**
 * VMI Scheduled Order Polling API
 *
 * POST /api/vmi-sync/scheduled/orders - Triggered by cron for scheduled order polling
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { VmiSalesOrderService } from '@/lib/services/vmi-sales-order.service';
import { vmiSyncService } from '@/lib/services/vmi-sync.service';

/**
 * POST /api/vmi-sync/scheduled/orders
 *
 * Scheduled order polling (triggered by cron job)
 * Supports both Vercel Cron and custom cron with secret
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization - accept either Vercel cron or custom secret
    const vercelCron = request.headers.get('x-vercel-cron');
    const cronSecret = request.headers.get('X-Cron-Secret');
    const expectedSecret = process.env.CRON_SECRET;

    const isVercelCron = vercelCron === '1';
    const isValidSecret = expectedSecret && cronSecret === expectedSecret;

    if (!isVercelCron && !isValidSecret) {
      console.log('[VMI Scheduled Sync] Order poll unauthorized attempt - no valid cron header or secret');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[VMI Scheduled Sync] Order poll triggered by', isVercelCron ? 'Vercel Cron' : 'Custom Cron');

    const service = new VmiSalesOrderService();
    const result = await service.pollOrders();

    // Record to sync history for each portal polled
    const errorPortalIds = new Set((result.errors || []).map(e => e.portalId));
    if (result.portalsPolled > 0) {
      try {
        await vmiSyncService.recordOrderPollHistory({
          ordersReceived: result.ordersReceived,
          errors: result.errors,
          errorPortalIds,
        });
      } catch (historyError) {
        console.error('[VMI Scheduled Sync] Failed to record sync history:', historyError);
      }
    }

    console.log('[VMI Scheduled Sync] Order poll completed:', {
      portalsPolled: result.portalsPolled,
      totalNewOrders: result.ordersReceived,
      portalsWithErrors: result.errors?.length || 0,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[VMI Sync API] Error in scheduled order poll:', error);

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
