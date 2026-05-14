// HR Role Permissions API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAppRoleById,
  getRolePermissions,
  updateRolePermissions,
} from '@/lib/services/hr.service';
import { invalidateRolePermissions } from '@/lib/auth/permission-resolver';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updatePermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()),
});

// GET /api/hr/roles/[id]/permissions - Get permissions for role
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const roleId = Number(id);

        // Check role exists
        const role = await getAppRoleById(roleId);
        if (!role) {
          return notFoundResponse('Role not found');
        }

        const permissions = await getRolePermissions(roleId);
        return successResponse(permissions);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/roles/[id]/permissions - Update permissions for role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const roleId = Number(id);
        const body = await request.json();

        // Validate input
        const parseResult = updatePermissionsSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        await updateRolePermissions(roleId, parseResult.data.permissionIds);

        // Drop the in-memory cache so the next request (including the same
        // admin's next page load) reflects the new assignments immediately
        // instead of waiting for the 60-second TTL.
        const role = await getAppRoleById(roleId);
        if (role) invalidateRolePermissions(role.code);

        // Return updated permissions
        const permissions = await getRolePermissions(roleId);
        return successResponse(permissions, 'Permissions updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Role not found') {
            return notFoundResponse(error.message);
          }
          if (error.message === 'Cannot modify permissions for system roles') {
            return errorResponse(error.message, 403);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
