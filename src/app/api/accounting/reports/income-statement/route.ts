// Income Statement Report API
// Feature: 010-accounting-module-integration
// User Story 5: Generate Financial Statements

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateIncomeStatement } from '@/lib/services/accounting-reports.service';

// GET /api/accounting/reports/income-statement - Generate Income Statement Report
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const periodStart = searchParams.get('periodStart');
        const periodEnd = searchParams.get('periodEnd');

        if (!periodStart || !periodEnd) {
          return errorResponse(
            'Both periodStart and periodEnd parameters are required (YYYY-MM-DD format)',
            400
          );
        }

        // Validate date formats
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart)) {
          return errorResponse('periodStart must be in YYYY-MM-DD format', 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) {
          return errorResponse('periodEnd must be in YYYY-MM-DD format', 400);
        }

        // Validate date order
        if (periodStart > periodEnd) {
          return errorResponse('periodStart must be before or equal to periodEnd', 400);
        }

        const report = await generateIncomeStatement(periodStart, periodEnd);

        return successResponse(report);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
