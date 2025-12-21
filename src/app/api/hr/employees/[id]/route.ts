// HR Employee by ID API
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
  getEmployeeProfile,
  updateEmployee,
} from '@/lib/services/hr.service';
import { employeeUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/employees/[id] - Get employee by ID (full profile)
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const profile = await getEmployeeProfile(Number(id));

        if (!profile) {
          return notFoundResponse('Employee not found');
        }

        return successResponse(profile);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/employees/[id] - Update employee
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = employeeUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const updateData = {
          firstName: parseResult.data.firstName,
          lastName: parseResult.data.lastName,
          firstNameEn: parseResult.data.firstNameEn,
          lastNameEn: parseResult.data.lastNameEn,
          email: parseResult.data.email,
          phone: parseResult.data.phone || undefined,
          positionId: parseResult.data.positionId ?? undefined,
          orgUnitId: parseResult.data.orgUnitId ?? undefined,
          siteId: parseResult.data.siteId ?? undefined,
          status: parseResult.data.status,
          terminationDate: parseResult.data.terminationDate,
        };
        const employee = await updateEmployee(Number(id), updateData);
        return successResponse(employee, 'Employee updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Employee not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
