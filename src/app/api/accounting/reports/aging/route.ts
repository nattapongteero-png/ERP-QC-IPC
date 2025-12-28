// Aging Report API
// Feature: 010-accounting-module-integration
// User Story 5: Generate Financial Statements

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateAgingReport } from '@/lib/services/accounting-reports.service';

// GET /api/accounting/reports/aging - Generate Aging Report (AP or AR)
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const reportType = searchParams.get('type') as 'AP' | 'AR' | null;
        const asOfDate = searchParams.get('asOfDate');

        if (!reportType) {
          return errorResponse('type parameter is required (AP or AR)', 400);
        }

        if (reportType !== 'AP' && reportType !== 'AR') {
          return errorResponse('type must be either AP or AR', 400);
        }

        if (!asOfDate) {
          return errorResponse('asOfDate parameter is required (YYYY-MM-DD format)', 400);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
          return errorResponse('asOfDate must be in YYYY-MM-DD format', 400);
        }

        const report = await generateAgingReport(reportType, asOfDate);

        return successResponse(report);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
