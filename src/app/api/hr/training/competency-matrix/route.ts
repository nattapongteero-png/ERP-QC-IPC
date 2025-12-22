// HR Training Competency Matrix API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEmployeeCompetencyMatrix,
  getCompetencyMatrixGrid,
} from '@/lib/services/hr.service';

// GET /api/hr/training/competency-matrix - Get competency matrix
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const employeeId = searchParams.get('employeeId');
        const employeeIds = searchParams.get('employeeIds');
        const courseIds = searchParams.get('courseIds');

        // Single employee matrix
        if (employeeId) {
          const matrix = await getEmployeeCompetencyMatrix(Number(employeeId));
          if (!matrix) {
            return notFoundResponse('Employee not found');
          }
          return successResponse(matrix);
        }

        // Grid matrix for multiple employees
        const empIds = employeeIds 
          ? employeeIds.split(',').map(Number).filter((n) => !isNaN(n))
          : undefined;
        const crsIds = courseIds
          ? courseIds.split(',').map(Number).filter((n) => !isNaN(n))
          : undefined;

        const matrices = await getCompetencyMatrixGrid(empIds, crsIds);
        return successResponse(matrices);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
