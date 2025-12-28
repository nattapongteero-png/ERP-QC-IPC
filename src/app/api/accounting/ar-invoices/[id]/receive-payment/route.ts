// AR Invoice Receive Payment API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { recordARPayment } from '@/lib/services/accounting.service';
import { z } from 'zod';

const receivePaymentSchema = z.object({
  paymentDate: z.string().min(1, 'Payment date is required'),
  bankAccountId: z.number().int().positive('Bank account is required'),
  paymentMethod: z.enum(['cash', 'check', 'transfer', 'other']),
  referenceNumber: z.string().optional(),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().optional(),
});

// POST /api/accounting/ar-invoices/[id]/receive-payment - Receive payment for AR invoice
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

        const body = await request.json();
        const parseResult = receivePaymentSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await recordARPayment(
          invoiceId,
          parseResult.data,
          session.userId
        );
        return successResponse(result, 'Payment received successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (
            error.message.includes('Cannot record payment') ||
            error.message.includes('exceeds')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:payments:write']
  );
}
