/**
 * Equipment log — the per-equipment history required by 21 CFR 211.182.
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { getEquipmentLog } from '@/lib/services/equipment-log.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const equipmentId = Number.parseInt(id, 10);
      if (Number.isNaN(equipmentId)) return errorResponse('Invalid equipment id');
      const data = await getEquipmentLog(equipmentId);
      if (!data.equipment) return errorResponse('Equipment not found', 404);
      return successResponse(data);
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}
