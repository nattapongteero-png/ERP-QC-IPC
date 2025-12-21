/**
 * VMI Sync Status Detail API
 *
 * GET /api/vmi-sync/status/[syncId] - Get specific sync operation details
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import { vmiSyncService, VmiSyncError } from '@/lib/services/vmi-sync.service';

interface RouteParams {
  params: Promise<{ syncId: string }>;
}

/**
 * GET /api/vmi-sync/status/[syncId]
 *
 * Get details of a specific sync operation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { syncId } = await params;
    const id = parseInt(syncId, 10);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid sync ID' },
        { status: 400 }
      );
    }

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

    // Get sync history record
    const record = await vmiSyncService.getSyncHistoryById(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Sync record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error('[VMI Sync API] Error getting sync details:', error);

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
