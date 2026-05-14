import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, getInsertId } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { eq, inArray, asc, and } from 'drizzle-orm';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/bom/[id]/sop-step-ipc
// Returns all IPC links attached to BOM's SOP steps. Joined with criteria
// master to surface code/name/spec/etc for the UI.
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (Number.isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const bomSteps = getTableRef('bOMSOPSteps');
      const linkTable = getTableRef('bOMSOPStepIPC');
      const ipcTable = getTableRef('iPCCriteria');

      const result = await executeDbOperation(async (db) => {
        // Get all bom step IDs for this BOM first.
        const stepRows = await db
          .select({ id: bomSteps.id })
          .from(bomSteps)
          .where(eq(bomSteps.bomId, bomId));
        const stepIds = stepRows.map((s: any) => s.id as number);
        if (stepIds.length === 0) return [];

        return db
          .select({
            id: linkTable.id,
            bomStepId: linkTable.bomStepId,
            procedureStepId: linkTable.procedureStepId,
            criteriaId: linkTable.criteriaId,
            sequence: linkTable.sequence,
            sampleSize: linkTable.sampleSize,
            isCritical: linkTable.isCritical,
            maxRetestRounds: linkTable.maxRetestRounds,
            notes: linkTable.notes,
            createdAt: linkTable.createdAt,
            criteriaCode: ipcTable.code,
            criteriaName: ipcTable.name,
            criteriaNameTh: ipcTable.nameTh,
            specification: ipcTable.specification,
            unit: ipcTable.unit,
            criteriaType: ipcTable.criteriaType,
            isCriteriaCritical: ipcTable.isCritical,
            masterMaxRetestRounds: ipcTable.maxRetestRounds,
          })
          .from(linkTable)
          .innerJoin(ipcTable, eq(linkTable.criteriaId, ipcTable.id))
          .where(inArray(linkTable.bomStepId, stepIds))
          .orderBy(asc(linkTable.bomStepId), asc(linkTable.sequence), asc(linkTable.id));
      });

      return successResponse(result);
    } catch (error) {
      console.error('Error fetching BOM SOP step IPC links:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/sop-step-ipc - Create new link
// Body: { bomStepId, procedureStepId?, criteriaId, sequence?, sampleSize?, isCritical?, maxRetestRounds?, notes? }
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (Number.isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const data = await request.json();
      if (!data.bomStepId || !data.criteriaId) {
        return errorResponse('bomStepId and criteriaId are required');
      }

      // Validate bomStepId belongs to this BOM.
      const bomSteps = getTableRef('bOMSOPSteps');
      const linkTable = getTableRef('bOMSOPStepIPC');
      const stepRow = await executeDbOperation(async (db) => {
        const rows = await db
          .select({ id: bomSteps.id, bomId: bomSteps.bomId })
          .from(bomSteps)
          .where(eq(bomSteps.id, Number(data.bomStepId)))
          .limit(1);
        return rows[0];
      });
      if (!stepRow) return errorResponse('SOP step not found');
      if (stepRow.bomId !== bomId) return errorResponse('SOP step does not belong to this BOM');

      // Reject duplicates on (bomStepId, procedureStepId, criteriaId).
      const existingDup = await executeDbOperation(async (db) => {
        return db
          .select({ id: linkTable.id })
          .from(linkTable)
          .where(and(
            eq(linkTable.bomStepId, Number(data.bomStepId)),
            eq(linkTable.criteriaId, Number(data.criteriaId)),
            data.procedureStepId
              ? eq(linkTable.procedureStepId, Number(data.procedureStepId))
              : undefined,
          ))
          .limit(1);
      });
      if (existingDup.length > 0) {
        return errorResponse('IPC criterion already linked to this step');
      }

      const result = await executeDbOperation(async (db) => {
        return db.insert(linkTable).values({
          bomStepId: Number(data.bomStepId),
          procedureStepId: data.procedureStepId ? Number(data.procedureStepId) : null,
          criteriaId: Number(data.criteriaId),
          sequence: data.sequence ? Number(data.sequence) : 1,
          sampleSize: data.sampleSize ? Number(data.sampleSize) : 1,
          isCritical: data.isCritical ?? false,
          maxRetestRounds: data.maxRetestRounds != null ? Number(data.maxRetestRounds) : null,
          notes: data.notes ?? null,
          createdAt: getNow(),
        });
      });

      return successResponse({ id: Number(getInsertId(result)) }, 'IPC link created');
    } catch (error) {
      console.error('Error creating BOM SOP step IPC link:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/bom/[id]/sop-step-ipc - Update link
// Body: { id, sequence?, sampleSize?, isCritical?, maxRetestRounds?, notes? }
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (Number.isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const data = await request.json();
      if (!data.id) return errorResponse('Link id is required');

      const linkTable = getTableRef('bOMSOPStepIPC');
      const updates: Record<string, unknown> = {};
      if (data.sequence !== undefined) updates.sequence = Number(data.sequence);
      if (data.sampleSize !== undefined) updates.sampleSize = Number(data.sampleSize);
      if (data.isCritical !== undefined) updates.isCritical = !!data.isCritical;
      if (data.maxRetestRounds !== undefined) {
        updates.maxRetestRounds = data.maxRetestRounds === null ? null : Number(data.maxRetestRounds);
      }
      if (data.notes !== undefined) updates.notes = data.notes ?? null;

      if (Object.keys(updates).length === 0) {
        return errorResponse('No fields to update');
      }

      await executeDbOperation(async (db) => {
        return db.update(linkTable).set(updates).where(eq(linkTable.id, Number(data.id)));
      });

      return successResponse(null, 'IPC link updated');
    } catch (error) {
      console.error('Error updating BOM SOP step IPC link:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/sop-step-ipc?linkId=N - Remove link
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);
      if (Number.isNaN(bomId)) return errorResponse('Invalid BOM ID');

      const { searchParams } = new URL(request.url);
      const linkId = searchParams.get('linkId');
      if (!linkId) return errorResponse('linkId required');

      const linkTable = getTableRef('bOMSOPStepIPC');
      await executeDbOperation(async (db) => {
        return db.delete(linkTable).where(eq(linkTable.id, Number(linkId)));
      });

      return successResponse(null, 'IPC link removed');
    } catch (error) {
      console.error('Error deleting BOM SOP step IPC link:', error);
      return serverErrorResponse(error);
    }
  });
}
