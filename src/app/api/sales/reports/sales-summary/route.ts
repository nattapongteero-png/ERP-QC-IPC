/**
 * Sales Report API
 *
 * GET /api/sales/reports/sales-summary?dateFrom=&dateTo=
 */

import { NextRequest } from 'next/server';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getSalesReport } from '@/lib/services/procurement-sales-report.service';

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const url = new URL(request.url);
        const dateFrom = url.searchParams.get('dateFrom') || undefined;
        const dateTo = url.searchParams.get('dateTo') || undefined;

        return successResponse(await getSalesReport({ dateFrom, dateTo }));
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['sales:read'],
  );
}
