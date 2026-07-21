/**
 * API: POST /api/sales/quotations/[id]/convert — convert an accepted quotation
 * into a sales order (list item 1d).
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { convertQuotationToSalesOrder } from '@/lib/services/quotation.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const quotationId = parseInt(id, 10);
      if (isNaN(quotationId)) return errorResponse('รหัสไม่ถูกต้อง', 400);
      const result = await convertQuotationToSalesOrder(quotationId, session.userId);
      return successResponse(result, 'แปลงเป็นใบสั่งขายสำเร็จ');
    } catch (error) {
      // Business-rule failures (no item-linked lines, already converted) come
      // back as plain Errors — surface the message as a 400, not a 500.
      if (error instanceof Error && !/database|drizzle|sql/i.test(error.message)) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error, 'convertQuotationToSalesOrder');
    }
  });
}
