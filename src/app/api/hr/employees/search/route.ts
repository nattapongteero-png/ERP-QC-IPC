// HR Employee Search API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getEmployees } from '@/lib/services/hr.service';
import type { EmployeeSummary } from '@/types/hr';

// GET /api/hr/employees/search - Search employees (returns summaries)
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('q') || searchParams.get('search');
        const status = searchParams.get('status');

        const employees = await getEmployees({
          search: search || undefined,
          status: status as 'active' | 'inactive' | 'terminated' | undefined,
        });

        // Transform to summaries (positions and org units would need to be joined)
        const summaries: EmployeeSummary[] = employees.map((e) => ({
          id: e.id,
          employeeCode: e.employeeCode,
          firstName: e.firstName,
          lastName: e.lastName,
          fullName: `${e.firstName} ${e.lastName}`,
          status: e.status,
          // positionTitle and orgUnitName would require joining
        }));

        return successResponse({ data: summaries });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
