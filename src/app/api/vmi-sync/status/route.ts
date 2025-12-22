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

    // Check permission
    if (!hasPermission(session.role as Role, 'vmi-sync:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams = {
      portalId: searchParams.get('portalId'),
      syncType: searchParams.get('syncType'),
      status: searchParams.get('status'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    };

    const validationResult = vmiSyncHistoryQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors,
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
