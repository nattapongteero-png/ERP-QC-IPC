// HR Health Records Overdue API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getOverdueHealthChecks } from '@/lib/services/hr.service';

// GET /api/hr/health-records/overdue - Get overdue health checks
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const overdue = await getOverdueHealthChecks();
        return successResponse(overdue);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
