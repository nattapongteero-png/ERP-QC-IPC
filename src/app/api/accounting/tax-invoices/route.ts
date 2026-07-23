// Tax Invoice Register API (ทะเบียนใบกำกับภาษี)
// List items 30-31 — exposes the tax invoices the app already records in
// vat_transactions so they can be viewed and printed.

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listTaxInvoices } from '@/lib/services/accounting-reports.service';

// GET /api/accounting/tax-invoices - List issued tax invoices
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);

        const filters: {
          transactionType?: 'input' | 'output';
          taxPeriod?: string;
          dateFrom?: string;
          dateTo?: string;
          search?: string;
        } = {};

        const transactionType = searchParams.get('transactionType');
        if (transactionType === 'input' || transactionType === 'output') {
          filters.transactionType = transactionType;
        }

        const taxPeriod = searchParams.get('taxPeriod');
        if (taxPeriod) filters.taxPeriod = taxPeriod;

        const dateFrom = searchParams.get('dateFrom');
        if (dateFrom) filters.dateFrom = dateFrom;

        const dateTo = searchParams.get('dateTo');
        if (dateTo) filters.dateTo = dateTo;

        const search = searchParams.get('search');
        if (search) filters.search = search;

        const taxInvoices = await listTaxInvoices(filters);
        return successResponse(taxInvoices);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:reports:read']
  );
}
