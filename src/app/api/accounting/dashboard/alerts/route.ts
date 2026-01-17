// Executive Alerts API
// Feature: 014-unit-cost (Executive Dashboard Redesign)

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveAlerts } from '@/lib/services/executive-dashboard.service';
import { getTodayStr } from '@/lib/db/date-utils';

// GET /api/accounting/dashboard/alerts
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || getTodayStr();

        const alerts = await getExecutiveAlerts(asOfDate);

        return successResponse(alerts);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
