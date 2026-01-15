/**
 * Production Cost Report API
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 *
 * GET /api/cost/reports/production-cost - Get production cost report
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getProductionCostReport } from '@/lib/services/unit-cost.service';

// GET /api/cost/reports/production-cost
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('dateFrom') || undefined;
      const dateTo = url.searchParams.get('dateTo') || undefined;
      const itemId = url.searchParams.get('itemId');
      const status = url.searchParams.get('status') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

      const result = await getProductionCostReport({
        dateFrom,
        dateTo,
        itemId: itemId ? parseInt(itemId) : undefined,
        status,
        page,
        pageSize,
      });

      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}
