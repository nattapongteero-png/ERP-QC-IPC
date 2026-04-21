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

        // Pass every validated field straight through — the service
        // handles each card's columns (personal, address, bank, etc.)
        // and only whitelisting the basic ones (as this route used to
        // do) silently dropped every other card on save.
        const { phone, positionId, orgUnitId, siteId, ...rest } = parseResult.data;
        const updateData = {
          ...rest,
          // preserve the old '' → undefined normalisation that the service expects
          phone: phone || undefined,
          // Zod schema allows null (to explicitly unset) but the service type
          // only accepts number | undefined; coerce null → undefined.
          positionId: positionId ?? undefined,
          orgUnitId: orgUnitId ?? undefined,
          siteId: siteId ?? undefined,
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
