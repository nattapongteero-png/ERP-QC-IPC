/**
 * VMI Sync Status API
 *
 * GET /api/vmi-sync/status - Get sync history
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import { vmiSyncService, VmiSyncError } from '@/lib/services/vmi-sync.service';
import { vmiSyncHistoryQuerySchema } from '@/lib/validation/vmi-portal';

/**
 * GET /api/vmi-sync/status
 *
 * Get sync history with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check permission (uses vmi-settings:read since sync status is part of VMI settings)
    if (!hasPermission(session.role as Role, 'vmi-settings:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse query parameters (filter out null values for Zod)
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, string> = {};

    const portalId = searchParams.get('portalId');
    const syncType = searchParams.get('syncType');
    const status = searchParams.get('status');
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (portalId) queryParams.portalId = portalId;
    if (syncType) queryParams.syncType = syncType;
    if (status) queryParams.status = status;
    if (page) queryParams.page = page;
    if (limit) queryParams.limit = limit;
    if (fromDate) queryParams.fromDate = fromDate;
    if (toDate) queryParams.toDate = toDate;

    const validationResult = vmiSyncHistoryQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    // Get sync history
    const result = await vmiSyncService.getSyncHistory(validationResult.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[VMI Sync API] Error getting sync status:', error);

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
