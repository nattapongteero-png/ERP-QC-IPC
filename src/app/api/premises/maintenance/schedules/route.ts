/**
 * Production equipment maintenance — schedules (GMP maintenance plan).
 * GET  list · POST create · PATCH update
 */
import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import {
  listMaintenanceSchedules,
  createMaintenanceSchedule,
  updateMaintenanceSchedule,
  MaintenanceError,
} from '@/lib/services/production-maintenance.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const sp = request.nextUrl.searchParams;
      const equipmentId = sp.get('equipmentId');
      const rows = await listMaintenanceSchedules({
        equipmentId: equipmentId ? Number(equipmentId) : undefined,
        lineCategory: sp.get('lineCategory') || undefined,
        activeOnly: sp.get('activeOnly') === 'true',
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
      const created = await createMaintenanceSchedule(body, session.userId);
      return successResponse(created, 'สร้างแผนบำรุงรักษาแล้ว');
    } catch (error) {
      if (error instanceof MaintenanceError) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}

export async function PATCH(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      if (!body?.id) return errorResponse('id is required');
      const updated = await updateMaintenanceSchedule(Number(body.id), body);
      return successResponse(updated, 'อัปเดตแผนบำรุงรักษาแล้ว');
    } catch (error) {
      if (error instanceof MaintenanceError) return errorResponse(error.message);
      return serverErrorResponse(error);
    }
  }, ['inventory:write']);
}
