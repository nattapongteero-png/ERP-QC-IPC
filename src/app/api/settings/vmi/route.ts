/**
 * VMI Portal Settings API
 *
 * GET  /api/settings/vmi - List all portal configurations
 * POST /api/settings/vmi - Create new portal configuration
 *
 * Feature: 008-vmi-vendor-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission, type Role } from '@/lib/auth';
import {
  vmiPortalConfigService,
  VmiPortalConfigError,
} from '@/lib/services/vmi-portal-config.service';
import { vmiPortalConfigCreateSchema } from '@/lib/validation/vmi-portal';

/**
 * GET /api/settings/vmi
 *
 * List all VMI portal configurations
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
    if (!hasPermission(session.role as Role, 'vmi-settings:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Get all portal configurations
    const portals = await vmiPortalConfigService.list();

    return NextResponse.json({
      success: true,
      data: portals,
    });
  } catch (error) {
    console.error('[VMI Settings API] Error listing portals:', error);

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
 * POST /api/settings/vmi
 *
 * Create new VMI portal configuration
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
    if (!hasPermission(session.role as Role, 'vmi-settings:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = vmiPortalConfigCreateSchema.safeParse(body);

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

    // Create portal configuration
    const portal = await vmiPortalConfigService.create(
      validationResult.data,
      session.userId
    );

    return NextResponse.json(
      {
        success: true,
        data: portal,
        message: 'Portal configuration created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[VMI Settings API] Error creating portal:', error);

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
