/**
 * VMI Portal Connection Test API
 *
 * POST /api/settings/vmi/[portalId]/test - Test connection to VMI Portal
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import {
  vmiPortalConfigService,
  VmiPortalConfigError,
} from '@/lib/services/vmi-portal-config.service';

interface RouteParams {
  params: Promise<{ portalId: string }>;
}

/**
 * POST /api/settings/vmi/[portalId]/test
 *
 * Test connection to VMI Portal
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { portalId } = await params;
    const id = parseInt(portalId, 10);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid portal ID' },
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
    if (!hasPermission(session.role as Role, 'vmi-settings:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Test connection
    const result = await vmiPortalConfigService.testConnection(id);

    return NextResponse.json({
      success: true,
      data: {
        connected: result.connected,
        latencyMs: result.latencyMs,
        vendorInfo: result.vendorInfo,
        testedAt: new Date().toISOString(),
        error: result.error
          ? {
              message: result.error,
            }
          : undefined,
      },
    });
  } catch (error) {
    console.error('[VMI Settings API] Error testing connection:', error);

    if (error instanceof VmiPortalConfigError) {
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
