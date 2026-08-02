// AR Invoices API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listARInvoices,
  createARInvoice,
  generateTaxInvoiceNumber,
} from '@/lib/services/accounting.service';
import { arInvoiceCreateSchema } from '@/lib/validation/accounting';

// GET /api/accounting/ar-invoices - List AR invoices
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const status = searchParams.get('status');
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const search = searchParams.get('search') || undefined;

        const invoices = await listARInvoices({
          customerId: customerId ? Number(customerId) : undefined,
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
    ['accounting:ar_invoices:read']
  );
}

// POST /api/accounting/ar-invoices - Create AR invoice
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = arInvoiceCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        // Generate tax invoice number
        const taxInvoiceNumber = await generateTaxInvoiceNumber(
          parseResult.data.invoiceDate
        );

        const invoice = await createARInvoice(
          {
            invoiceNumber: parseResult.data.invoiceNumber,
            taxInvoiceNumber,
            customerId: parseResult.data.customerId,
            salesOrderId: parseResult.data.salesOrderId,
            invoiceDate: parseResult.data.invoiceDate,
            dueDate: parseResult.data.dueDate,
            description: parseResult.data.description,
            currency: parseResult.data.currency,
            exchangeRate: parseResult.data.exchangeRate,
            vatInclusive: (parseResult.data as { vatInclusive?: boolean }).vatInclusive,
            lines: parseResult.data.lines,
          },
          session.userId
        );
        return successResponse(invoice, 'AR invoice created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ar_invoices:write']
  );
}
