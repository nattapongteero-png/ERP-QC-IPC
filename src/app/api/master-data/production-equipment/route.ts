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
import { executeDbOperation, getTableRef, dbOperations } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { desc, eq } from 'drizzle-orm';

// GET /api/master-data/production-equipment - List production equipment
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const equipmentType = searchParams.get('equipmentType') || undefined;
      const roomId = searchParams.get('roomId');
      const isActive = searchParams.get('isActive');

      // Fetch single item by ID
      if (id) {
        const raw = await getProductionEquipmentById(Number(id));
        if (!raw) return successResponse(null);
        const item = { ...raw.equipment, room: raw.room };
        return successResponse(item);
      }

      const rawEquipment = await getProductionEquipment({
        equipmentType,
        roomId: roomId ? Number(roomId) : undefined,
        isActive: isActive !== null ? isActive === 'true' : true,
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

      // Auto-generate code if not provided
      if (!data.code) {
        const table = getTableRef('productionEquipment');
        const latest = await executeDbOperation(async (db) => {
          const rows = await db.select({ code: table.code }).from(table).orderBy(desc(table.id)).limit(1);
          return rows[0]?.code as string | undefined;
        });
        const lastNum = latest ? parseInt(latest.replace(/\D/g, '') || '0') : 0;
        data.code = `EQ-${String(lastNum + 1).padStart(4, '0')}`;
      }

      // Validate required fields
      if (!data.name || !data.nameTh || !data.equipmentType) {
        return errorResponse('Missing required fields: name, nameTh, equipmentType');
      }

      // Upsert — update if code exists
      const table = getTableRef('productionEquipment');
      const existing = await executeDbOperation(async (db) => {
        const rows = await db.select({ id: table.id }).from(table).where(eq(table.code, data.code));
        return rows[0];
      });

      if (existing) {
        const updated = await updateProductionEquipment(existing.id as number, {
          name: data.name, nameTh: data.nameTh, equipmentType: data.equipmentType,
          capacity: data.capacity, roomId: data.roomId, description: data.description, isActive: data.isActive ?? true,
          calibrationCertNumber: data.calibrationCertNumber ?? null,
          calibrationDate: data.calibrationDate || null,
          calibrationExpiryDate: data.calibrationExpiryDate || null,
        });
        return successResponse(updated, 'Production equipment updated (code existed)');
      }

      const equipment = await createProductionEquipment({
        code: data.code, name: data.name, nameTh: data.nameTh, equipmentType: data.equipmentType,
        capacity: data.capacity, roomId: data.roomId, description: data.description, isActive: data.isActive ?? true,
        calibrationCertNumber: data.calibrationCertNumber ?? null,
        calibrationDate: data.calibrationDate || null,
        calibrationExpiryDate: data.calibrationExpiryDate || null,
      });

      return successResponse(equipment, 'Production equipment created successfully');
    } catch (error) {
      console.error('Error creating production equipment:', error);
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
        calibrationCertNumber: data.calibrationCertNumber ?? null,
        calibrationDate: data.calibrationDate || null,
        calibrationExpiryDate: data.calibrationExpiryDate || null,
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

      // Real DELETE if never referenced; soft-disable when any FK (BOM,
      // maintenance, scale verification, etc.) still points at it.
      const result = await dbOperations.deleteOrDisableById('productionEquipment', Number(id), {
        updatedAt: getNow(),
      });
      return successResponse(
        { mode: result.mode },
        result.mode === 'deleted'
          ? 'Production equipment deleted successfully'
          : 'Production equipment is in use — disabled instead of deleted',
      );
    } catch (error) {
      console.error('Error deleting production equipment:', error);
      return serverErrorResponse(error);
    }
  });
}
