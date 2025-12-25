// WHT Certificates Report API
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateWHTCertificateSummary } from '@/lib/services/accounting-reports.service';
import { listWHTCertificates } from '@/lib/services/accounting.service';

// GET /api/accounting/reports/wht-certificates - List WHT Certificates or Generate Summary
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const taxPeriod = searchParams.get('taxPeriod');
        const certificateType = searchParams.get('certificateType') as 'pnd3' | 'pnd53' | null;
        const format = searchParams.get('format') || 'list'; // 'list' or 'summary'
        const vendorId = searchParams.get('vendorId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        // For summary format, taxPeriod and certificateType are required
        if (format === 'summary') {
          if (!taxPeriod) {
            return errorResponse('taxPeriod parameter is required for summary format (YYYY-MM)', 400);
          }

          if (!/^\d{4}-\d{2}$/.test(taxPeriod)) {
            return errorResponse('taxPeriod must be in YYYY-MM format', 400);
          }

          if (!certificateType) {
            return errorResponse('certificateType parameter is required (pnd3 or pnd53)', 400);
          }

          if (certificateType !== 'pnd3' && certificateType !== 'pnd53') {
            return errorResponse('certificateType must be either pnd3 or pnd53', 400);
          }

          const report = await generateWHTCertificateSummary(taxPeriod, certificateType);
          return successResponse(report);
        }

        // For list format, use filters
        const filters: {
          certificateType?: 'pnd3' | 'pnd53';
          taxPeriod?: string;
          vendorId?: number;
          startDate?: string;
          endDate?: string;
        } = {};

        if (certificateType && (certificateType === 'pnd3' || certificateType === 'pnd53')) {
          filters.certificateType = certificateType;
        }

        if (taxPeriod) {
          if (!/^\d{4}-\d{2}$/.test(taxPeriod)) {
            return errorResponse('taxPeriod must be in YYYY-MM format', 400);
          }
          filters.taxPeriod = taxPeriod;
        }

        if (vendorId) {
          const vendorIdNum = parseInt(vendorId, 10);
          if (isNaN(vendorIdNum)) {
            return errorResponse('vendorId must be a valid number', 400);
          }
          filters.vendorId = vendorIdNum;
        }

        if (startDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            return errorResponse('startDate must be in YYYY-MM-DD format', 400);
          }
          filters.startDate = startDate;
        }

        if (endDate) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
            return errorResponse('endDate must be in YYYY-MM-DD format', 400);
          }
          filters.endDate = endDate;
        }

        const certificates = await listWHTCertificates(filters);
        return successResponse(certificates);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
