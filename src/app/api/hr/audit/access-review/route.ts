// HR Access Review API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAccessReviewReport } from '@/lib/services/hr.service';

// GET /api/hr/audit/access-review - Get access review report
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const report = await getAccessReviewReport();
        return successResponse(report);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
