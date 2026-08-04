/**
 * Purchasing dashboard data — layer 1/2/3 in one payload.
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, serverErrorResponse } from '@/lib/api-utils';
import { getPurchasingDashboard } from '@/lib/services/purchasing-dashboard.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      return successResponse(await getPurchasingDashboard());
    } catch (error) {
      console.error('Error building purchasing dashboard:', error);
      return serverErrorResponse(error);
    }
  });
}
