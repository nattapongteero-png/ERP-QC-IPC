// AP Invoice Approve API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { approveAPInvoice } from '@/lib/services/accounting.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/accounting/ap-invoices/[id]/approve - Approve AP invoice
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);

        if (isNaN(invoiceId)) {
          return errorResponse('Invalid invoice ID', 400);
        }

        const invoice = await approveAPInvoice(invoiceId, session.userId);
        return successResponse(invoice, 'AP invoice approved and posted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Cannot approve') ||
            error.message.includes('no lines') ||
            error.message.includes('GL account')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:approve']
  );
}
