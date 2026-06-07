import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { setLotQcDisposition } from '@/lib/services/inventory.service';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/inventory/lots/[id]/qc-disposition
 * QC Flow item 6 — Step 1: QC records the quality verdict on a quarantined lot.
 * Role: quality:approve (QC department). Does NOT release the lot into stock;
 * the warehouse must still verify the physical count via /release.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const lotId = parseInt(id);
      if (isNaN(lotId)) return errorResponse('Invalid lot ID');

      const body = await request.json();
      const { decision, reason } = body ?? {};
      if (decision !== 'approved' && decision !== 'rejected') {
        return errorResponse("decision must be 'approved' or 'rejected'");
      }

      const result = await setLotQcDisposition(lotId, decision, session.userId, reason);
      return successResponse(
        result,
        decision === 'approved'
          ? 'QC อนุมัติคุณภาพแล้ว — รอฝ่ายคลังตรวจนับและปล่อยเข้าคลัง'
          : 'QC ปฏิเสธคุณภาพ lot นี้แล้ว',
      );
    } catch (error) {
      if (error instanceof Error) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['quality:approve']);
}
