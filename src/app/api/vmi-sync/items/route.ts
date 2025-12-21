/**
 * VMI Items Sync API
 *
 * POST /api/vmi-sync/items - Sync item catalog to VMI Portal(s)
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import { vmiSyncService, VmiSyncError } from '@/lib/services/vmi-sync.service';
import { vmiItemsSyncRequestSchema } from '@/lib/validation/vmi-portal';

/**
 * POST /api/vmi-sync/items
 *
 * Manually trigger item catalog sync to VMI Portal(s)
 */
export async function POST(request: NextRequest) {
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
    if (!hasPermission(session.role as Role, 'vmi-sync:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = vmiItemsSyncRequestSchema.safeParse(body);

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

    // Run sync
    const results = await vmiSyncService.syncItems(
      validationResult.data,
      'manual',
      session.userId
    );

    // Return results
    if (results.length === 1) {
      return NextResponse.json({
        success: true,
        data: results[0],
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        portalsProcessed: results.length,
        results,
      },
    });
  } catch (error) {
    console.error('[VMI Sync API] Error syncing items:', error);

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
