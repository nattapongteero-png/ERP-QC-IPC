// HR Application Roles API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAppRoles, createAppRole } from '@/lib/services/hr.service';
import { appRoleCreateSchema } from '@/lib/validation/hr';
import { z } from 'zod';

const roleQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  isSystemRole: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

// GET /api/hr/roles - List application roles
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = roleQuerySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters: {
          isActive?: boolean;
          isSystemRole?: boolean;
          search?: string;
        } = {};

        if (queryResult.success) {
          if (queryResult.data.isActive !== undefined) {
            filters.isActive = queryResult.data.isActive === 'true';
          }
          if (queryResult.data.isSystemRole !== undefined) {
            filters.isSystemRole = queryResult.data.isSystemRole === 'true';
          }
          if (queryResult.data.search) {
            filters.search = queryResult.data.search;
          }
        }

        const roles = await getAppRoles(filters);
        return successResponse(roles);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/roles - Create application role
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = appRoleCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const role = await createAppRole(parseResult.data);
        return successResponse(role, 'Role created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Role code already exists') {
            return errorResponse(error.message, 409);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
