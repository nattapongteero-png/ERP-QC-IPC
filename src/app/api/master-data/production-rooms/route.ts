import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getProductionRooms,
  createProductionRoom,
  updateProductionRoom,
  deactivateProductionRoom,
  getProductionRoomById,
} from '@/lib/services/master-data.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { desc } from 'drizzle-orm';

// External API Key — same key used across master data APIs
const EXTERNAL_API_KEY = process.env.EXTERNAL_ENV_API_KEY || 'env-monitor-2026-secret';

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('X-API-Key');
  return !!apiKey && apiKey === EXTERNAL_API_KEY;
}

// GET /api/master-data/production-rooms - List production rooms
// Supports both session cookie (internal) and X-API-Key (external)
export async function GET(request: NextRequest) {
  const handleGet = async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const roomType = searchParams.get('roomType') || undefined;
      const isActive = searchParams.get('isActive');

      if (id) {
        const room = await getProductionRoomById(Number(id));
        if (!room) return successResponse(null);
        return successResponse(room);
      }

      const rooms = await getProductionRooms({
        roomType,
        isActive: isActive !== null ? isActive === 'true' : true,
      });

      return successResponse(rooms);
    } catch (error) {
      console.error('Error fetching production rooms:', error);
      return serverErrorResponse(error);
    }
  };

  // API Key auth (external)
  if (validateApiKey(request)) {
    return handleGet();
  }

  // Session auth (internal — existing behavior)
  return withAuth(request, handleGet);
}

// POST /api/master-data/production-rooms - Create production room
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Auto-generate code if not provided
      if (!data.code) {
        const table = getTableRef('productionRooms');
        const latest = await executeDbOperation(async (db) => {
          const rows = await db.select({ code: table.code }).from(table).orderBy(desc(table.id)).limit(1);
          return rows[0]?.code as string | undefined;
        });
        const lastNum = latest ? parseInt(latest.replace(/\D/g, '') || '0') : 0;
        data.code = `ROOM-${String(lastNum + 1).padStart(4, '0')}`;
      }

      // Validate required fields
      if (!data.name || !data.nameTh || !data.roomType) {
        return errorResponse('Missing required fields: name, nameTh, roomType');
      }

      const room = await createProductionRoom({
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        roomType: data.roomType,
        description: data.description,
        isActive: data.isActive ?? true,
      });

      return successResponse(room, 'Production room created successfully');
    } catch (error) {
      console.error('Error creating production room:', error);
      const errMsg = String((error as Error).message || '') + String((error as any).cause?.message || '');
      if (errMsg.includes('UNIQUE constraint') || errMsg.includes('Duplicate entry')) {
        return errorResponse('Room code already exists');
      }
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/production-rooms - Update production room
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing room ID');
      }

      const existing = await getProductionRoomById(data.id);
      if (!existing) {
        return errorResponse('Production room not found');
      }

      const room = await updateProductionRoom(data.id, {
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        roomType: data.roomType,
        description: data.description,
        isActive: data.isActive,
      });

      return successResponse(room, 'Production room updated successfully');
    } catch (error) {
      console.error('Error updating production room:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/production-rooms - Soft delete (deactivate) production room
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return errorResponse('Missing room ID');
      }

      const existing = await getProductionRoomById(Number(id));
      if (!existing) {
        return errorResponse('Production room not found');
      }

      await deactivateProductionRoom(Number(id));
      return successResponse(null, 'Production room deactivated successfully');
    } catch (error) {
      console.error('Error deactivating production room:', error);
      return serverErrorResponse(error);
    }
  });
}
