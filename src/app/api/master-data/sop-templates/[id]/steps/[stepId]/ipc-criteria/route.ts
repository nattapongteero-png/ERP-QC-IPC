import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listProcedureStepIPC,
  addProcedureStepIPC,
  updateProcedureStepIPC,
  removeProcedureStepIPC,
} from '@/lib/services/sop-template-ipc.service';

type RouteParams = { params: Promise<{ id: string; stepId: string }> };

// GET /api/master-data/sop-templates/[id]/steps/[stepId]/ipc-criteria
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { stepId } = await params;
      const procedureStepId = Number(stepId);
      if (isNaN(procedureStepId)) return errorResponse('Invalid step ID');
      const rows = await listProcedureStepIPC(procedureStepId);
      return successResponse(rows);
    } catch (error) {
      console.error('Error listing step IPC links:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/sop-templates/[id]/steps/[stepId]/ipc-criteria
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { stepId } = await params;
      const procedureStepId = Number(stepId);
      if (isNaN(procedureStepId)) return errorResponse('Invalid step ID');

      const data = await request.json();
      if (!data.criteriaId) return errorResponse('criteriaId is required');

      const result = await addProcedureStepIPC({
        procedureStepId,
        criteriaId: Number(data.criteriaId),
        sequence: data.sequence ? Number(data.sequence) : undefined,
        sampleSize: data.sampleSize ? Number(data.sampleSize) : undefined,
        isCritical: data.isCritical ?? undefined,
        notes: data.notes ?? null,
      });
      return successResponse(result, 'IPC criteria linked');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.startsWith('DUPLICATE:')) return errorResponse(msg);
      console.error('Error linking IPC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/sop-templates/[id]/steps/[stepId]/ipc-criteria
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { stepId } = await params;
      const procedureStepId = Number(stepId);
      if (isNaN(procedureStepId)) return errorResponse('Invalid step ID');

      const data = await request.json();
      if (!data.linkId) return errorResponse('linkId is required');

      await updateProcedureStepIPC(Number(data.linkId), {
        sequence: data.sequence !== undefined ? Number(data.sequence) : undefined,
        sampleSize: data.sampleSize !== undefined ? Number(data.sampleSize) : undefined,
        isCritical: data.isCritical !== undefined ? !!data.isCritical : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
      });
      return successResponse(null, 'Link updated');
    } catch (error) {
      console.error('Error updating step IPC link:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/sop-templates/[id]/steps/[stepId]/ipc-criteria?linkId=N
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { stepId } = await params;
      const procedureStepId = Number(stepId);
      if (isNaN(procedureStepId)) return errorResponse('Invalid step ID');

      const { searchParams } = new URL(request.url);
      const linkId = searchParams.get('linkId');
      if (!linkId) return errorResponse('linkId query parameter is required');

      await removeProcedureStepIPC(Number(linkId));
      return successResponse(null, 'Link removed');
    } catch (error) {
      console.error('Error removing step IPC link:', error);
      return serverErrorResponse(error);
    }
  });
}
