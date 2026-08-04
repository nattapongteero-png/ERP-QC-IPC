/**
 * Sales dashboard data — margin, OTIF, backlog, win rate, overdue AR, funnel.
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, serverErrorResponse } from '@/lib/api-utils';
import { getSalesDashboard } from '@/lib/services/sales-dashboard.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      return successResponse(await getSalesDashboard());
    } catch (error) {
      console.error('Error building sales dashboard:', error);
      return serverErrorResponse(error);
    }
  });
}
