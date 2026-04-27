// AP Invoice Single Item API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAPInvoiceById,
  updateAPInvoice,
  deleteAPInvoice,
} from '@/lib/services/accounting.service';
import { apInvoiceUpdateSchema } from '@/lib/validation/accounting';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/ap-invoices/[id] - Get AP invoice by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);

        if (isNaN(invoiceId)) {
          return errorResponse('Invalid invoice ID', 400);
        }

        const invoice = await getAPInvoiceById(invoiceId);
        return successResponse(invoice);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse('AP invoice not found');
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:read']
  );
}

// PUT /api/accounting/ap-invoices/[id] - Update AP invoice
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);

        if (isNaN(invoiceId)) {
          return errorResponse('Invalid invoice ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = apInvoiceUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const invoice = await updateAPInvoice(
          invoiceId,
          parseResult.data,
          session.userId
        );
        return successResponse(invoice, 'AP invoice updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:write']
  );
}

// DELETE /api/accounting/ap-invoices/[id] - Delete draft AP invoice
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const invoiceId = Number(id);

        if (isNaN(invoiceId)) {
          return errorResponse('Invalid invoice ID', 400);
        }

        await deleteAPInvoice(invoiceId, session.userId);
        return successResponse(null, 'AP invoice deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:write']
  );
}
