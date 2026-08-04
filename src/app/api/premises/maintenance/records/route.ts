/**
 * Production equipment maintenance — completed jobs (the GMP log entries).
 * GET  list · POST record a job · PATCH verify (second signature, 211.182)
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import {
  listMaintenanceRecords,
  createMaintenanceRecord,
  verifyMaintenanceRecord,
  setEquipmentServiceStatus,
  MaintenanceError,
} from '@/lib/services/production-maintenance.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const sp = request.nextUrl.searchParams;
      const equipmentId = sp.get('equipmentId');
      const rows = await listMaintenanceRecords({
        equipmentId: equipmentId ? Number(equipmentId) : undefined,
        limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
      });
      return successResponse(rows);
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      if (!body?.equipmentId) return errorResponse('equipmentId is required');
      const created = await createMaintenanceRecord(body, session.userId);
      return successResponse(created, 'บันทึกงานบำรุงรักษาแล้ว');
    } catch (error) {
      if (error instanceof MaintenanceError) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      // Two distinct actions share this route: sign off a record, or move the
      // equipment in/out of service while work is going on.
      if (body?.action === 'setStatus') {
        if (!body.equipmentId || !body.status) return errorResponse('equipmentId and status are required');
        const res = await setEquipmentServiceStatus(Number(body.equipmentId), body.status);
        return successResponse(res, 'อัปเดตสถานะอุปกรณ์แล้ว');
      }
      if (!body?.id) return errorResponse('id is required');
      const res = await verifyMaintenanceRecord(Number(body.id), session.userId);
      return successResponse(res, 'ทวนสอบบันทึกแล้ว');
    } catch (error) {
      if (error instanceof MaintenanceError) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}
