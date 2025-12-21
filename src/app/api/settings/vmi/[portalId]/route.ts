/**
 * VMI Portal Settings API - Individual Portal
 *
 * GET    /api/settings/vmi/[portalId] - Get portal configuration
 * PUT    /api/settings/vmi/[portalId] - Update portal configuration
 * DELETE /api/settings/vmi/[portalId] - Delete portal configuration
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import {
  vmiPortalConfigService,
  VmiPortalConfigError,
} from '@/lib/services/vmi-portal-config.service';
import { vmiPortalConfigUpdateSchema } from '@/lib/validation/vmi-portal';

interface RouteParams {
  params: Promise<{ portalId: string }>;
}

/**
 * GET /api/settings/vmi/[portalId]
 *
 * Get portal configuration by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Get portal configuration
    const portal = await vmiPortalConfigService.getById(id);

    if (!portal) {
      return NextResponse.json(
        { success: false, error: 'Portal configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: portal,
    });
  } catch (error) {
    console.error('[VMI Settings API] Error getting portal:', error);

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

/**
 * PUT /api/settings/vmi/[portalId]
 *
 * Update portal configuration
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    if (!hasPermission(session.role as Role, 'vmi-settings:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = vmiPortalConfigUpdateSchema.safeParse(body);

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

    // Update portal configuration
    const portal = await vmiPortalConfigService.update(
      id,
      validationResult.data,
      session.userId
    );

    return NextResponse.json({
      success: true,
      data: portal,
      message: 'Portal configuration updated successfully',
    });
  } catch (error) {
    console.error('[VMI Settings API] Error updating portal:', error);

    if (error instanceof VmiPortalConfigError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.httpStatus }
      );
    }

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      return NextResponse.json(
        { success: false, error: 'Portal with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/vmi/[portalId]
 *
 * Delete portal configuration
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    if (!hasPermission(session.role as Role, 'vmi-settings:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Delete portal configuration
    await vmiPortalConfigService.delete(id);

    return NextResponse.json({
      success: true,
      message: 'Portal configuration deleted successfully',
    });
  } catch (error) {
    console.error('[VMI Settings API] Error deleting portal:', error);

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
