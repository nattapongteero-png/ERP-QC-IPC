// Executive Dashboard Charts API
// Returns the revenue/expense trend and expense breakdown computed from posted journal
// lines. Replaces the client-side Math.random() trend and hardcoded expense categories.

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getRevenueExpenseTrend,
  getExpenseBreakdown,
} from '@/lib/services/executive-dashboard.service';
import { getTodayStr } from '@/lib/db/date-utils';

// GET /api/accounting/dashboard/charts?asOfDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || getTodayStr();

        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
          return errorResponse('asOfDate must be in YYYY-MM-DD format', 400);
        }

        // Expense breakdown covers the year to date, matching the trend's window
        const yearStart = `${asOfDate.slice(0, 4)}-01-01`;

        const [trend, expenseBreakdown] = await Promise.all([
          getRevenueExpenseTrend(asOfDate),
          getExpenseBreakdown(yearStart, asOfDate),
        ]);

        return successResponse({ trend, expenseBreakdown });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
