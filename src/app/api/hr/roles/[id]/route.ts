// HR Application Role by ID API
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
  updateAppRole,
  deactivateAppRole,
} from '@/lib/services/hr.service';
import { appRoleUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/roles/[id] - Get role by ID with permissions
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const role = await getAppRoleById(Number(id));

        if (!role) {
          return notFoundResponse('Role not found');
        }

        return successResponse(role);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/roles/[id] - Update role
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = appRoleUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const role = await updateAppRole(Number(id), parseResult.data);
        return successResponse(role, 'Role updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Role not found') {
            return notFoundResponse(error.message);
          }
          if (error.message === 'Cannot modify system roles') {
            return errorResponse(error.message, 403);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}

// DELETE /api/hr/roles/[id] - Deactivate role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const role = await deactivateAppRole(Number(id));
        return successResponse(role, 'Role deactivated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Role not found') {
            return notFoundResponse(error.message);
          }
          if (error.message === 'Cannot modify system roles') {
            return errorResponse(error.message, 403);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
