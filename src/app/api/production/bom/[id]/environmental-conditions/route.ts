import { NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMEnvironmentalConditions,
  addBOMEnvironmentalCondition,
  removeBOMEnvironmentalCondition,
} from '@/lib/services/bom-configuration.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

// Valid phases for environmental conditions
const VALID_PHASES = ['pre_production', 'production', 'pre_packaging', 'packaging'];

// GET /api/production/bom/[id]/environmental-conditions - Get environmental conditions for BOM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const { searchParams } = new URL(request.url);
      const phase = searchParams.get('phase') || undefined;

      if (phase && !VALID_PHASES.includes(phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      const rawConditions = await getBOMEnvironmentalConditions(bomId, phase);
      // Flatten the nested structure for frontend
      const conditions = rawConditions.map((item: { bomCondition: Record<string, unknown>; condition: unknown }) => ({
        ...item.bomCondition,
        condition: item.condition,
      }));
      return successResponse(conditions);
    } catch (error) {
      console.error('Error fetching BOM environmental conditions:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/environmental-conditions - Link condition profile to BOM phase
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const data = await request.json();

      // Validate required fields
      if (!data.conditionId || !data.phase) {
        return errorResponse('Missing required fields: conditionId, phase');
      }

      if (!VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      // Resolve bomRoomId: caller can pass it explicitly, otherwise auto-link
      // to an existing bom_room with the same (bomId, phase). Rejecting orphans
      // keeps this table tied to the room master and prevents the legacy
      // behaviour that left bomRoomId=NULL and caused drifted/ghost entries.
      let bomRoomId: number | undefined = data.bomRoomId ? Number(data.bomRoomId) : undefined;
      if (!bomRoomId) {
        const bomRoomsTable = getTableRef('bOMRooms');
        const candidates = await executeDbOperation(async (db) => {
          return db
            .select({ id: bomRoomsTable.id })
            .from(bomRoomsTable)
            .where(and(eq(bomRoomsTable.bomId, bomId), eq(bomRoomsTable.phase, data.phase)));
        });
        if (candidates.length === 0) {
          return errorResponse(
            `No room configured for phase '${data.phase}' in this BOM. Add a room first before linking an environmental condition.`,
          );
        }
        if (candidates.length > 1) {
          return errorResponse(
            `Multiple rooms configured for phase '${data.phase}'. Please pass 'bomRoomId' to specify which room this condition applies to.`,
          );
        }
        bomRoomId = candidates[0].id as number;
      }

      const condition = await addBOMEnvironmentalCondition({
        bomId,
        conditionId: data.conditionId,
        bomRoomId,
        phase: data.phase,
      });

      return successResponse(condition, 'Environmental condition linked to BOM');
    } catch (error) {
      console.error('Error adding BOM environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/environmental-conditions - Unlink condition
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const { searchParams } = new URL(request.url);
      const bomConditionId = searchParams.get('bomConditionId');

      if (!bomConditionId) {
        return errorResponse('Missing bomConditionId parameter');
      }

      await removeBOMEnvironmentalCondition(Number(bomConditionId));
      return successResponse(null, 'Environmental condition unlinked from BOM');
    } catch (error) {
      console.error('Error removing BOM environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}
