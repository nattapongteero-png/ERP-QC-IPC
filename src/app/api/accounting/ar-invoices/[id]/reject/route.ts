// AR Invoice Reject API (list item 2 — approval workflow)
// Rejects a draft invoice with a required reason before it is posted to the GL.

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { rejectARInvoice } from '@/lib/services/accounting.service';

// POST /api/accounting/ar-invoices/[id]/reject
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

        const body = await request.json().catch(() => ({}));
        const reason = typeof body?.reason === 'string' ? body.reason : '';
        if (!reason.trim()) {
          return errorResponse('ต้องระบุเหตุผลในการปฏิเสธใบแจ้งหนี้', 400);
        }

        const invoice = await rejectARInvoice(invoiceId, reason, session.userId);
        return successResponse(invoice, 'ปฏิเสธใบแจ้งหนี้แล้ว');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('ปฏิเสธ') || error.message.includes('draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:ar_invoices:confirm']
  );
}
