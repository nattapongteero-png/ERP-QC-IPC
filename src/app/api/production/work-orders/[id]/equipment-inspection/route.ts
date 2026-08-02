import { NextRequest } from 'next/server';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import {
  getWOEquipmentInspectionItems,
  recordWOEquipmentInspection,
} from '@/lib/services/wo-equipment-inspection.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

const VALID_PHASES = ['pre_production', 'production', 'post_production', 'pre_packaging', 'packaging'];

// GET /api/production/work-orders/[id]/equipment-inspection?phase=pre_production
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const { searchParams } = new URL(request.url);
      const phase = searchParams.get('phase') || 'pre_production';
      if (!VALID_PHASES.includes(phase)) return errorResponse('Invalid phase');

      const items = await getWOEquipmentInspectionItems(workOrderId, phase);
      return successResponse(items);
    } catch (error) {
      console.error('Error fetching WO equipment inspection:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/equipment-inspection — record a result
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const data = await request.json();
      if (!data.equipmentId || (data.result !== 'pass' && data.result !== 'fail')) {
        return errorResponse('Missing required fields: equipmentId, result (pass|fail)');
      }
      const phase = data.phase || 'pre_production';
      if (!VALID_PHASES.includes(phase)) return errorResponse('Invalid phase');

      const created = await recordWOEquipmentInspection(
        {
          workOrderId,
          phase,
          equipmentId: Number(data.equipmentId),
          bomEquipmentId: data.bomEquipmentId ? Number(data.bomEquipmentId) : undefined,
          result: data.result,
          checklistResults: data.checklistResults,
          notes: data.notes,
        },
        session.userId,
      );

      try { publishWorkOrderChanged(workOrderId, 'equipment-inspection', session.userId); } catch { /* realtime best-effort */ }
      return successResponse(created, 'Equipment inspection recorded');
    } catch (error) {
      console.error('Error recording WO equipment inspection:', error);
      return serverErrorResponse(error);
    }
  });
}
