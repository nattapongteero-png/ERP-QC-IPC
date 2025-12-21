// HR Employee Role by ID API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { revokeEmployeeRole } from '@/lib/services/hr.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/hr/employee-roles/[id] - Revoke employee role
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const employeeRole = await revokeEmployeeRole(Number(id));
        return successResponse(employeeRole, 'Role revoked successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Employee role not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
