// HR Employees API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getEmployees, createEmployee } from '@/lib/services/hr.service';
import { employeeCreateSchema } from '@/lib/validation/hr';

// GET /api/hr/employees - List employees
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const orgUnitId = searchParams.get('orgUnitId');
        const positionId = searchParams.get('positionId');
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        const employees = await getEmployees({
          orgUnitId: orgUnitId ? Number(orgUnitId) : undefined,
          positionId: positionId ? Number(positionId) : undefined,
          status: status as 'active' | 'inactive' | 'terminated' | undefined,
          search: search || undefined,
        });

        return successResponse(employees);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/employees - Create employee
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = employeeCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const employee = await createEmployee(parseResult.data);
        return successResponse(employee, 'Employee created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
