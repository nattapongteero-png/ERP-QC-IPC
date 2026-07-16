/**
 * One delivery note, for printing.
 *
 * GET /api/sales/deliveries/[number]
 *
 * A delivery number can cover several lines (one per lot), so this returns the
 * header once with every line under it — what a printed note needs.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDeliveryNote } from '@/lib/services/delivery-note.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  return withAuth(
    request,
    async () => {
      try {
        const { number } = await params;
        const note = await getDeliveryNote(decodeURIComponent(number));
        if (!note) return notFoundResponse('ไม่พบใบส่งของนี้');
        return successResponse(note);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['sales:read'],
  );
}
