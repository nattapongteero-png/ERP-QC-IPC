import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { releaseLotWithCount } from '@/lib/services/inventory.service';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/inventory/lots/[id]/release
 * QC Flow item 6 — Step 2: Warehouse verifies the physical count, then releases
 * the lot into usable stock. Requires QC disposition = approved first.
 * Role: inventory:write (warehouse department).
 *
 * Body: { countedQuantity: number, varianceReason?: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const lotId = parseInt(id);
      if (isNaN(lotId)) return errorResponse('Invalid lot ID');

      const body = await request.json();
      const { countedQuantity, varianceReason } = body ?? {};
      if (countedQuantity === undefined || countedQuantity === null) {
        return errorResponse('กรุณากรอกจำนวนที่นับจริง');
      }

      const result = await releaseLotWithCount(
        lotId,
        Number(countedQuantity),
        session.userId,
        varianceReason,
      );
      return successResponse(result, 'ปล่อย lot เข้าคลังเรียบร้อย');
    } catch (error) {
      if (error instanceof Error) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}
