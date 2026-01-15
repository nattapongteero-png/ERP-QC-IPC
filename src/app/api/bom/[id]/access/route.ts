/**
 * BOM Access Management API
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 *
 * Endpoints:
 * - GET /api/bom/[id]/access - List access grants for a BOM
 * - POST /api/bom/[id]/access - Grant access to a BOM
 * - DELETE /api/bom/[id]/access?grantId=X - Revoke access grant
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMAccessList,
  grantBOMAccess,
  revokeBOMAccess,
  canViewConfidentialItems,
} from '@/lib/services/confidentiality.service';
import { bomAccessGrantSchema } from '@/lib/validation/confidentiality';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/bom/[id]/access
 * List all access grants for a specific BOM
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const bomId = parseInt(id);

        if (isNaN(bomId)) {
          return errorResponse('Invalid BOM ID');
        }

        // Check if user can manage access (same permission as viewing confidential items)
        const canManage = await canViewConfidentialItems(
          session.userId,
          bomId,
          session.role
        );

        if (!canManage) {
          return errorResponse('Access denied', 403);
        }

        const grants = await getBOMAccessList(bomId);
        return successResponse(grants);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['production:read']
  );
}

/**
 * POST /api/bom/[id]/access
 * Grant access to a BOM for a user or group
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const bomId = parseInt(id);

        if (isNaN(bomId)) {
          return errorResponse('Invalid BOM ID');
        }

        // Check if user can manage access
        const canManage = await canViewConfidentialItems(
          session.userId,
          bomId,
          session.role
        );

        if (!canManage) {
          return errorResponse('Access denied', 403);
        }

        // Parse and validate request body
        const body = await request.json();
        const validation = bomAccessGrantSchema.safeParse(body);

        if (!validation.success) {
          const errors = validation.error.issues.map((e) => e.message).join(', ');
          return errorResponse(errors);
        }

        // Grant access
        const result = await grantBOMAccess(
          {
            bomId,
            ...validation.data,
          },
          session.userId
        );

        return NextResponse.json({ success: true, data: result }, { status: 201 });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['production:write']
  );
}

/**
 * DELETE /api/bom/[id]/access?grantId=X
 * Revoke an access grant
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const bomId = parseInt(id);

        if (isNaN(bomId)) {
          return errorResponse('Invalid BOM ID');
        }

        // Check if user can manage access
        const canManage = await canViewConfidentialItems(
          session.userId,
          bomId,
          session.role
        );

        if (!canManage) {
          return errorResponse('Access denied', 403);
        }

        // Get grantId from query params
        const { searchParams } = new URL(request.url);
        const grantIdParam = searchParams.get('grantId');

        if (!grantIdParam) {
          return errorResponse('grantId query parameter is required');
        }

        const grantId = parseInt(grantIdParam);
        if (isNaN(grantId)) {
          return errorResponse('Invalid grantId');
        }

        // Revoke access
        await revokeBOMAccess(grantId);

        return successResponse({ id: grantId }, 'Access revoked successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['production:write']
  );
}
