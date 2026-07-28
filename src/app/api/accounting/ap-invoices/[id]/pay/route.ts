// AP Invoice Payment API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { recordAPPayment } from '@/lib/services/accounting.service';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const paymentSchema = z.object({
  paymentDate: z.string(),
  bankAccountId: z.number().int().positive(),
  paymentMethod: z.enum(['cash', 'check', 'transfer', 'other']),
  referenceNumber: z.string().optional().nullable(),
  amount: z.number().positive(),
  whtRate: z.number().min(0).max(100).optional(),
  // ภ.ง.ด.3 = natural person, ภ.ง.ด.53 = juristic person. Defaults to pnd53
  // in the service when omitted.
  whtCertificateType: z.enum(['pnd3', 'pnd53']).optional(),
  whtType: z.string().max(255).optional(),
  description: z.string().optional().nullable(),
});

// POST /api/accounting/ap-invoices/[id]/pay - Record payment for AP invoice
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

        const body = await request.json();

        // Validate input
        const parseResult = paymentSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await recordAPPayment(
          invoiceId,
          {
            paymentDate: parseResult.data.paymentDate,
            bankAccountId: parseResult.data.bankAccountId,
            paymentMethod: parseResult.data.paymentMethod,
            referenceNumber: parseResult.data.referenceNumber || undefined,
            amount: parseResult.data.amount,
            whtRate: parseResult.data.whtRate,
            whtCertificateType: parseResult.data.whtCertificateType,
            whtType: parseResult.data.whtType,
            description: parseResult.data.description || undefined,
          },
          session.userId
        );

        return successResponse(result, 'Payment recorded successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Cannot record') ||
            error.message.includes('exceeds')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ap_invoices:pay']
  );
}
