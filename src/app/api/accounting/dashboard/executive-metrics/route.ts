// Executive Metrics API
// Feature: 014-unit-cost (Executive Dashboard Redesign)

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveMetrics } from '@/lib/services/executive-dashboard.service';
import { getTodayStr } from '@/lib/db/date-utils';

// GET /api/accounting/dashboard/executive-metrics
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || getTodayStr();
        const period = (searchParams.get('period') || 'YTD') as 'MTD' | 'QTD' | 'YTD' | 'custom';
        const customStart = searchParams.get('customStart') || undefined;

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
          return errorResponse('asOfDate must be in YYYY-MM-DD format', 400);
        }

        if (customStart && !/^\d{4}-\d{2}-\d{2}$/.test(customStart)) {
          return errorResponse('customStart must be in YYYY-MM-DD format', 400);
        }

        const metrics = await getExecutiveMetrics(asOfDate, period, customStart);

        return successResponse(metrics);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
