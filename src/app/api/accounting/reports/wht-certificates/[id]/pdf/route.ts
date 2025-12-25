// WHT Certificate PDF API
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateWHTCertificatePDF } from '@/lib/services/accounting-reports.service';
import { getWHTCertificateById } from '@/lib/services/accounting.service';

// GET /api/accounting/reports/wht-certificates/[id]/pdf - Get WHT Certificate PDF Data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const certificateId = parseInt(id, 10);

        if (isNaN(certificateId)) {
          return errorResponse('Invalid certificate ID', 400);
        }

        // First check if certificate exists
        const certificate = await getWHTCertificateById(certificateId);
        if (!certificate) {
          return errorResponse('WHT certificate not found', 404);
        }

        // Generate PDF data
        const pdfData = await generateWHTCertificatePDF(certificateId);
        if (!pdfData) {
          return errorResponse('Failed to generate PDF data', 500);
        }

        return successResponse(pdfData);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
