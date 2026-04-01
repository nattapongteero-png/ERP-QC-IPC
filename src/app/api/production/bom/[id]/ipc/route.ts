import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, getInsertId } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { eq, asc } from 'drizzle-orm';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/bom/[id]/ipc - Get BOM IPC criteria
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const bomIpc = getTableRef('bOMInProcessQC');
      const ipcCriteria = getTableRef('iPCCriteria');

      const result = await executeDbOperation(async (db) => {
        return db
          .select({
            id: bomIpc.id,
            bomId: bomIpc.bomId,
            criteriaId: bomIpc.criteriaId,
            sequence: bomIpc.sequence,
            sampleSize: bomIpc.sampleSize,
            isCritical: bomIpc.isCritical,
            // Criteria details
            criteriaCode: ipcCriteria.code,
            criteriaName: ipcCriteria.name,
            criteriaNameTh: ipcCriteria.nameTh,
            testMethod: ipcCriteria.testMethod,
            specification: ipcCriteria.specification,
            minValue: ipcCriteria.minValue,
            maxValue: ipcCriteria.maxValue,
            unit: ipcCriteria.unit,
          })
          .from(bomIpc)
          .innerJoin(ipcCriteria, eq(bomIpc.criteriaId, ipcCriteria.id))
          .where(eq(bomIpc.bomId, bomId))
          .orderBy(asc(bomIpc.sequence));
      });

      return successResponse(result);
    } catch (error) {
      console.error('Error fetching BOM IPC config:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/ipc - Add IPC criteria to BOM
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const data = await request.json();
      if (!data.criteriaId) return errorResponse('criteriaId is required');

      const bomIpc = getTableRef('bOMInProcessQC');

      // Get next sequence
      const existing = await executeDbOperation(async (db) => {
        return db.select().from(bomIpc).where(eq(bomIpc.bomId, bomId));
      });
      const nextSeq = existing.length + 1;

      const result = await executeDbOperation(async (db) => {
        return db.insert(bomIpc).values({
          bomId,
          criteriaId: data.criteriaId,
          sequence: data.sequence || nextSeq,
          sampleSize: data.sampleSize || 5,
          isCritical: data.isCritical ?? false,
          createdAt: getNow(),
        } as any);
      });

      return successResponse({ id: getInsertId(result) }, 'IPC criteria added to BOM');
    } catch (error) {
      console.error('Error adding IPC criteria to BOM:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/bom/[id]/ipc - Update BOM IPC config
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const data = await request.json();
      if (!data.bomIpcId) return errorResponse('bomIpcId is required');

      const bomIpc = getTableRef('bOMInProcessQC');
      const updateData: Record<string, unknown> = {};
      if (data.sequence !== undefined) updateData.sequence = data.sequence;
      if (data.sampleSize !== undefined) updateData.sampleSize = data.sampleSize;
      if (data.isCritical !== undefined) updateData.isCritical = data.isCritical;

      await executeDbOperation(async (db) => {
        return db.update(bomIpc).set(updateData as any).where(eq(bomIpc.id, data.bomIpcId));
      });

      return successResponse(null, 'BOM IPC config updated');
    } catch (error) {
      console.error('Error updating BOM IPC config:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/ipc?bomIpcId=123
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const { searchParams } = new URL(request.url);
      const bomIpcId = searchParams.get('bomIpcId');
      if (!bomIpcId) return errorResponse('bomIpcId query param is required');

      const bomIpc = getTableRef('bOMInProcessQC');
      await executeDbOperation(async (db) => {
        return db.delete(bomIpc).where(eq(bomIpc.id, Number(bomIpcId)));
      });

      return successResponse(null, 'IPC criteria removed from BOM');
    } catch (error) {
      console.error('Error removing IPC criteria from BOM:', error);
      return serverErrorResponse(error);
    }
  });
}
