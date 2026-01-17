/**
 * Confidential Bypass Roles Setting API
 * Feature: BOM Confidentiality Protection (014-unit-cost)
 *
 * Endpoints:
 * - GET /api/admin/settings/confidential-bypass-roles - Get bypass roles
 * - PUT /api/admin/settings/confidential-bypass-roles - Update bypass roles
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBypassRoles,
  setBypassRoles,
} from '@/lib/services/confidentiality.service';
import { bypassRolesSettingSchema } from '@/lib/validation/confidentiality';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const roles = await getBypassRoles();
      return successResponse({ roles });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:read']);
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const validation = bypassRolesSettingSchema.safeParse(body);

      if (!validation.success) {
        return errorResponse(validation.error.issues[0].message);
      }

      await setBypassRoles(validation.data.roles);
      return successResponse({ success: true });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['admin:write']);
}
