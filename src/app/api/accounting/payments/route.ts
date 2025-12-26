// Payments API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listPayments } from '@/lib/services/accounting.service';

// GET /api/accounting/payments - List payments with optional filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);

        const filters: {
          paymentType?: 'ap' | 'ar';
          paymentMethod?: string;
          dateFrom?: string;
          dateTo?: string;
          vendorId?: number;
          customerId?: number;
        } = {};

        const paymentType = searchParams.get('paymentType');
        if (paymentType === 'ap' || paymentType === 'ar') {
          filters.paymentType = paymentType;
        }

        const paymentMethod = searchParams.get('paymentMethod');
        if (paymentMethod) {
          filters.paymentMethod = paymentMethod;
        }

        const dateFrom = searchParams.get('dateFrom');
        if (dateFrom) {
          filters.dateFrom = dateFrom;
        }

        const dateTo = searchParams.get('dateTo');
        if (dateTo) {
          filters.dateTo = dateTo;
        }

        const vendorId = searchParams.get('vendorId');
        if (vendorId) {
          filters.vendorId = parseInt(vendorId, 10);
        }

        const customerId = searchParams.get('customerId');
        if (customerId) {
          filters.customerId = parseInt(customerId, 10);
        }

        const payments = await listPayments(filters);
        return successResponse(payments);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:payments:read']
  );
}
