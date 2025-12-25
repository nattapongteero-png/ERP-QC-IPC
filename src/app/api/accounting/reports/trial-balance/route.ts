// Trial Balance Report API
// Feature: 010-accounting-module-integration
// User Story 5: Generate Financial Statements

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateTrialBalance } from '@/lib/services/accounting-reports.service';

// GET /api/accounting/reports/trial-balance - Generate Trial Balance Report
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate');
        const fiscalYearStart = searchParams.get('fiscalYearStart') || undefined;

        if (!asOfDate) {
          return errorResponse('asOfDate parameter is required (YYYY-MM-DD format)', 400);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
          return errorResponse('asOfDate must be in YYYY-MM-DD format', 400);
        }

        if (fiscalYearStart && !/^\d{4}-\d{2}-\d{2}$/.test(fiscalYearStart)) {
          return errorResponse('fiscalYearStart must be in YYYY-MM-DD format', 400);
        }

        const report = await generateTrialBalance(asOfDate, fiscalYearStart);

        return successResponse(report);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
