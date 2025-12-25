// AR Invoice by ID API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getARInvoiceById,
  updateARInvoice,
} from '@/lib/services/accounting.service';
import { arInvoiceUpdateSchema } from '@/lib/validation/accounting';

// GET /api/accounting/ar-invoices/[id] - Get AR invoice by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);
        if (isNaN(invoiceId) || invoiceId <= 0) {
          return errorResponse('Invalid invoice ID', 400);
        }

        const invoice = await getARInvoiceById(invoiceId);
        return successResponse(invoice);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return errorResponse(error.message, 404);
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ar_invoices:read']
  );
}

// PUT /api/accounting/ar-invoices/[id] - Update AR invoice
export async function PUT(
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

        const body = await request.json();
        const parseResult = arInvoiceUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const invoice = await updateARInvoice(
          invoiceId,
          parseResult.data,
          session.userId
        );
        return successResponse(invoice, 'AR invoice updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (
            error.message.includes('Cannot update') ||
            error.message.includes('draft')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ar_invoices:write']
  );
}
