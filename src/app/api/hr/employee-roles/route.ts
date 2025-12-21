// HR Employee Roles API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEmployeeRoles,
  assignEmployeeRole,
} from '@/lib/services/hr.service';
import { employeeRoleCreateSchema } from '@/lib/validation/hr';
import { z } from 'zod';

const querySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
});

// GET /api/hr/employee-roles - Get roles for an employee
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        if (!queryResult.success) {
          return errorResponse('employeeId is required', 400);
        }

        const roles = await getEmployeeRoles(queryResult.data.employeeId);
        return successResponse(roles);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/employee-roles - Assign role to employee
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = employeeRoleCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const employeeRole = await assignEmployeeRole(parseResult.data, session.userId);
        return successResponse(employeeRole, 'Role assigned successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === 'Employee not found' ||
            error.message === 'Role not found'
          ) {
            return errorResponse(error.message, 404);
          }
          if (error.message === 'Cannot assign inactive role') {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
