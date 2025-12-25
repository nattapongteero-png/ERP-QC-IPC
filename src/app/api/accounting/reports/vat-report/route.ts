// VAT Report API (Por Por 30)
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateVATReport, generateVATSummaryReport } from '@/lib/services/accounting-reports.service';

// GET /api/accounting/reports/vat-report - Generate VAT Report (Por Por 30)
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const taxPeriod = searchParams.get('taxPeriod');
        const format = searchParams.get('format') || 'standard'; // 'standard' or 'summary'

        if (!taxPeriod) {
          return errorResponse('taxPeriod parameter is required (YYYY-MM format)', 400);
        }

        // Validate tax period format (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(taxPeriod)) {
          return errorResponse('taxPeriod must be in YYYY-MM format', 400);
        }

        // Generate report based on format
        if (format === 'summary') {
          const report = await generateVATSummaryReport(taxPeriod);
          return successResponse(report);
        }

        const report = await generateVATReport(taxPeriod);
        return successResponse(report);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
