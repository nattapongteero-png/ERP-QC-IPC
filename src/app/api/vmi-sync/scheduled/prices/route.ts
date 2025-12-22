/**
 * VMI Scheduled Prices Sync API
 *
 * POST /api/vmi-sync/scheduled/prices - Triggered by cron for scheduled sync
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { vmiSyncService, VmiSyncError } from '@/lib/services/vmi-sync.service';

/**
 * POST /api/vmi-sync/scheduled/prices
 *
 * Scheduled prices sync (triggered by cron job)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('X-Cron-Secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run scheduled sync
    const result = await vmiSyncService.runScheduledPricesSync();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[VMI Sync API] Error in scheduled prices sync:', error);

    if (error instanceof VmiSyncError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.httpStatus }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
