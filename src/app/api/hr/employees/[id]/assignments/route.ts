// HR Employee Assignments API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEmployeeAssignments,
  getEmployeeById,
} from '@/lib/services/hr.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/employees/[id]/assignments - Get employee assignment history
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const employeeId = Number(id);

        // Verify employee exists
        const employee = await getEmployeeById(employeeId);
        if (!employee) {
          return notFoundResponse('Employee not found');
        }

        const assignments = await getEmployeeAssignments(employeeId);
        return successResponse(assignments);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
