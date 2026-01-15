/**
 * Cost Summary Report API
 * Feature: 014-unit-cost (US7 - Cost Reports Dashboard)
 *
 * GET /api/cost/reports/cost-summary - Get cost summary report
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getCostSummaryReport } from '@/lib/services/unit-cost.service';

// GET /api/cost/reports/cost-summary
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const url = new URL(request.url);
      const itemType = url.searchParams.get('itemType') || undefined;
      const categoryId = url.searchParams.get('categoryId');
      const search = url.searchParams.get('search') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

      const result = await getCostSummaryReport({
        itemType,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        search,
        page,
        pageSize,
      });

      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}
