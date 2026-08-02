// AP Invoices API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listAPInvoices,
  createAPInvoice,
} from '@/lib/services/accounting.service';
import { apInvoiceCreateSchema } from '@/lib/validation/accounting';

// GET /api/accounting/ap-invoices - List AP invoices
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const vendorId = searchParams.get('vendorId');
        const status = searchParams.get('status');
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const search = searchParams.get('search') || undefined;

        const invoices = await listAPInvoices({
          vendorId: vendorId ? Number(vendorId) : undefined,
          status: status || undefined,
          dateFrom,
          dateTo,
          search,
        });

        return successResponse(invoices);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:read']
  );
}

// POST /api/accounting/ap-invoices - Create AP invoice
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = apInvoiceCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const invoice = await createAPInvoice(
          {
            invoiceNumber: parseResult.data.invoiceNumber,
            vendorId: parseResult.data.vendorId,
            purchaseOrderId: parseResult.data.purchaseOrderId,
            invoiceDate: parseResult.data.invoiceDate,
            dueDate: parseResult.data.dueDate,
            receivedDate: parseResult.data.receivedDate,
            description: parseResult.data.description,
            currency: parseResult.data.currency,
            exchangeRate: parseResult.data.exchangeRate,
            vatRate: parseResult.data.vatRate,
            vatAmountOverride: parseResult.data.vatAmountOverride,
            vatInclusive: (parseResult.data as { vatInclusive?: boolean }).vatInclusive,
            lines: parseResult.data.lines,
          },
          session.userId
        );
        return successResponse(invoice, 'AP invoice created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:write']
  );
}
