// AR Invoice Confirm API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { confirmARInvoice } from '@/lib/services/accounting.service';

// POST /api/accounting/ar-invoices/[id]/confirm - Confirm AR invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);
        if (isNaN(invoiceId) || invoiceId <= 0) {
          return errorResponse('Invalid invoice ID', 400);
        }

        const invoice = await confirmARInvoice(invoiceId, session.userId);
        return successResponse(invoice, 'AR invoice confirmed successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (
            error.message.includes('Cannot confirm') ||
            error.message.includes('draft')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ar_invoices:confirm']
  );
}
