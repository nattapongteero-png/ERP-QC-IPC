import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMRooms,
  addBOMRoom,
  updateBOMRoom,
  removeBOMRoom,
} from '@/lib/services/bom-configuration.service';

// Valid phases for room requirements
const VALID_PHASES = ['pre_production', 'production', 'post_production', 'pre_packaging', 'packaging'];

// GET /api/production/bom/[id]/rooms - Get rooms required for BOM by phase
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

      const rawRooms = await getBOMRooms(bomId, phase);
      // Flatten the nested structure for frontend
      const rooms = rawRooms.map((item: { bomRoom: Record<string, unknown>; room: unknown }) => ({
        ...item.bomRoom,
        room: item.room,
      }));
      return successResponse(rooms);
    } catch (error) {
      console.error('Error fetching BOM rooms:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/rooms - Add room requirement to BOM
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
      if (!data.roomId || !data.phase) {
        return errorResponse('Missing required fields: roomId, phase');
      }

      if (!VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      const room = await addBOMRoom({
        bomId,
        roomId: data.roomId,
        phase: data.phase,
        sequence: data.sequence ?? 1,
        isRequired: data.isRequired ?? true,
      });

      return successResponse(room, 'Room requirement added to BOM');
    } catch (error) {
      console.error('Error adding BOM room:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/bom/[id]/rooms - Update room requirement
export async function PUT(
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

      if (!data.bomRoomId) {
        return errorResponse('Missing bomRoomId');
      }

      if (data.phase && !VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      const room = await updateBOMRoom(data.bomRoomId, {
        roomId: data.roomId,
        phase: data.phase,
        sequence: data.sequence,
        isRequired: data.isRequired,
      });

      return successResponse(room, 'Room requirement updated');
    } catch (error) {
      console.error('Error updating BOM room:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/rooms - Remove room requirement
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
      const bomRoomId = searchParams.get('bomRoomId');

      if (!bomRoomId) {
        return errorResponse('Missing bomRoomId parameter');
      }

      await removeBOMRoom(Number(bomRoomId));
      return successResponse(null, 'Room requirement removed from BOM');
    } catch (error) {
      console.error('Error removing BOM room:', error);
      return serverErrorResponse(error);
    }
  });
}
