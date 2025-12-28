// WHT Certificate Detail API
// Feature: 010-accounting-module-integration
// User Story 6: Manage VAT and Withholding Tax

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getWHTCertificateById } from '@/lib/services/accounting.service';

// GET /api/accounting/reports/wht-certificates/[id] - Get WHT Certificate by ID
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

        const certificate = await getWHTCertificateById(certificateId);
        if (!certificate) {
          return errorResponse('WHT certificate not found', 404);
        }

        return successResponse(certificate);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
