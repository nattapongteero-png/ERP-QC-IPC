/**
 * VMI Scheduled Inventory Sync API
 *
 * POST /api/vmi-sync/scheduled/inventory - Triggered by cron for scheduled sync
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { vmiSyncService, VmiSyncError } from '@/lib/services/vmi-sync.service';

/**
 * POST /api/vmi-sync/scheduled/inventory
 *
 * Scheduled inventory sync (triggered by cron job)
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
      console.log('[VMI Scheduled Sync] Unauthorized attempt - no valid cron header or secret');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[VMI Scheduled Sync] Inventory sync triggered by', isVercelCron ? 'Vercel Cron' : 'Custom Cron');

    // Run scheduled sync
    const result = await vmiSyncService.runScheduledInventorySync();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[VMI Sync API] Error in scheduled inventory sync:', error);

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
