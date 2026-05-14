// Payment by ID API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { deletePayment, updatePayment } from '@/lib/services/accounting.service';

// PUT /api/accounting/payments/[id] - Update payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const paymentId = Number(id);
        if (isNaN(paymentId) || paymentId <= 0) {
          return errorResponse('Invalid payment ID', 400);
        }

        const body = await request.json();
        await updatePayment(paymentId, body, session.userId);
        return successResponse(null, 'Payment updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('cancelled')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:payments:write']
  );
}

// DELETE /api/accounting/payments/[id] - Delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const paymentId = Number(id);
        if (isNaN(paymentId) || paymentId <= 0) {
          return errorResponse('Invalid payment ID', 400);
        }

        await deletePayment(paymentId, session.userId);
        return successResponse(null, 'Payment deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('cancelled')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:payments:write']
  );
}
