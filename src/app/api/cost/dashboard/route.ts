/**
 * Cost Dashboard API
 * Feature: 014-unit-cost (US7 - Executive Cost Dashboard)
 *
 * GET /api/cost/dashboard - Get executive dashboard KPIs
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getExecutiveDashboardKPIs } from '@/lib/services/unit-cost.service';

// GET /api/cost/dashboard?period=this_month&from=2026-01-01&to=2026-01-31
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const periodType = searchParams.get('period') || 'this_month';
      const fromDate = searchParams.get('from') || undefined;
      const toDate = searchParams.get('to') || undefined;

      const kpis = await getExecutiveDashboardKPIs(periodType, fromDate, toDate);
      return successResponse(kpis);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}
