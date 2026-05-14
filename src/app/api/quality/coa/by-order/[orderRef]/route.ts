/**
 * GET /api/quality/coa/by-order/[orderRef] — Phase 8
 *
 * Return all COA documents linked to a given sales order ref. Used by the
 * Sales Order detail page to show "Quality Certificates" section.
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listCoaForOrder } from '@/lib/services/coa.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderRef: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { orderRef } = await params;
      const ref = decodeURIComponent(orderRef);
      if (!ref) return errorResponse('orderRef is required');
      const items = await listCoaForOrder(ref);
      return successResponse({ items });
    } catch (error) {
      console.error('Error listing COA by order:', error);
      return serverErrorResponse(error);
    }
  });
}
