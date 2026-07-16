/**
 * Delivery notes register — every delivery across all sales orders.
 *
 * GET /api/sales/deliveries?dateFrom=&dateTo=&status=&soId=
 *
 * The existing /api/sales/orders/[id]/deliveries is scoped to one order, so it
 * cannot answer "what shipped this week".
 */

import { NextRequest } from 'next/server';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { listDeliveryNotes } from '@/lib/services/delivery-note.service';

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const url = new URL(request.url);
        const soIdParam = url.searchParams.get('soId');

        return successResponse(
          await listDeliveryNotes({
            dateFrom: url.searchParams.get('dateFrom') || undefined,
            dateTo: url.searchParams.get('dateTo') || undefined,
            status: url.searchParams.get('status') || undefined,
            soId: soIdParam ? parseInt(soIdParam, 10) : undefined,
          }),
        );
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['sales:read'],
  );
}
