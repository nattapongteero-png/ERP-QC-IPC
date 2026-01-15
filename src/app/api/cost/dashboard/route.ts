/**
 * Cost Dashboard API
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 *
 * GET /api/cost/dashboard - Get dashboard KPIs
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getCostDashboardKPIs } from '@/lib/services/unit-cost.service';

// GET /api/cost/dashboard
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const kpis = await getCostDashboardKPIs();
      return successResponse(kpis);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}
