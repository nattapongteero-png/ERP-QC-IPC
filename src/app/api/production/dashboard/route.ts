/**
 * Production dashboard data — layer 1/2/3 in one payload.
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, serverErrorResponse } from '@/lib/api-utils';
import { getProductionDashboard } from '@/lib/services/production-dashboard.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      return successResponse(await getProductionDashboard());
    } catch (error) {
      console.error('Error building production dashboard:', error);
      return serverErrorResponse(error);
    }
  });
}
