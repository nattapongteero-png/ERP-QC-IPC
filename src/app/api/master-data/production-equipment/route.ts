import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getProductionEquipment,
  createProductionEquipment,
  updateProductionEquipment,
  deactivateProductionEquipment,
  getProductionEquipmentById,
} from '@/lib/services/master-data.service';

// GET /api/master-data/production-equipment - List production equipment
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const equipmentType = searchParams.get('equipmentType') || undefined;
      const roomId = searchParams.get('roomId');
      const isActive = searchParams.get('isActive');

      const rawEquipment = await getProductionEquipment({
        equipmentType,
        roomId: roomId ? Number(roomId) : undefined,
        isActive: isActive ? isActive === 'true' : undefined,
      });

      // Flatten the nested structure for frontend
      const equipment = rawEquipment.map((item: { equipment: Record<string, unknown>; room: unknown }) => ({
        ...item.equipment,
        room: item.room,
      }));

      return successResponse(equipment);
    } catch (error) {
      console.error('Error fetching production equipment:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/production-equipment - Create production equipment
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Validate required fields
      if (!data.code || !data.name || !data.nameTh || !data.equipmentType) {
        return errorResponse('Missing required fields: code, name, nameTh, equipmentType');
      }

      const equipment = await createProductionEquipment({
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        equipmentType: data.equipmentType,
        capacity: data.capacity,
        roomId: data.roomId,
        description: data.description,
        isActive: data.isActive ?? true,
      });

      return successResponse(equipment, 'Production equipment created successfully');
    } catch (error) {
      console.error('Error creating production equipment:', error);
      if ((error as Error).message?.includes('UNIQUE constraint')) {
        return errorResponse('Equipment code already exists');
      }
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/production-equipment - Update production equipment
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing equipment ID');
      }

      const existing = await getProductionEquipmentById(data.id);
      if (!existing) {
        return errorResponse('Production equipment not found');
      }

      const equipment = await updateProductionEquipment(data.id, {
        code: data.code,
        name: data.name,
        nameTh: data.nameTh,
        equipmentType: data.equipmentType,
        capacity: data.capacity,
        roomId: data.roomId,
        description: data.description,
        isActive: data.isActive,
      });

      return successResponse(equipment, 'Production equipment updated successfully');
    } catch (error) {
      console.error('Error updating production equipment:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/production-equipment - Soft delete (deactivate)
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return errorResponse('Missing equipment ID');
      }

      const existing = await getProductionEquipmentById(Number(id));
      if (!existing) {
        return errorResponse('Production equipment not found');
      }

      await deactivateProductionEquipment(Number(id));
      return successResponse(null, 'Production equipment deactivated successfully');
    } catch (error) {
      console.error('Error deactivating production equipment:', error);
      return serverErrorResponse(error);
    }
  });
}
