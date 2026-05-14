import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEnvironmentalConditions,
  createEnvironmentalCondition,
  updateEnvironmentalCondition,
  getEnvironmentalConditionById,
} from '@/lib/services/master-data.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { desc, eq } from 'drizzle-orm';

// GET /api/master-data/environmental-conditions - List environmental conditions
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const isActive = searchParams.get('isActive');

      if (id) {
        const condition = await getEnvironmentalConditionById(Number(id));
        if (!condition) return successResponse(null);
        return successResponse(condition);
      }

      const conditions = await getEnvironmentalConditions({
        isActive: isActive !== null ? isActive === 'true' : true,
      });

      return successResponse(conditions);
    } catch (error) {
      console.error('Error fetching environmental conditions:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/environmental-conditions - Create environmental condition
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Auto-generate code if not provided
      if (!data.code) {
        const table = getTableRef('environmentalConditions');
        const latest = await executeDbOperation(async (db) => {
          const rows = await db.select({ code: table.code }).from(table).orderBy(desc(table.id)).limit(1);
          return rows[0]?.code as string | undefined;
        });
        const lastNum = latest ? parseInt(latest.replace(/\D/g, '') || '0') : 0;
        data.code = `ENV-${String(lastNum + 1).padStart(4, '0')}`;
      }

      if (!data.name) {
        return errorResponse('Missing required field: name');
      }

      // Validate temperature range
      if (data.temperatureMax !== undefined && data.temperatureMin !== undefined) {
        if (data.temperatureMax <= data.temperatureMin) {
          return errorResponse('Temperature max must be greater than temperature min');
        }
      }

      const condData = {
        name: data.name, temperatureMin: data.temperatureMin ?? 20, temperatureMax: data.temperatureMax ?? 30,
        humidityMax: data.humidityMax ?? 60, monitoringIntervalMinutes: data.monitoringIntervalMinutes ?? 60,
        notes: data.notes, isActive: data.isActive ?? true,
      };

      // Upsert — update if code exists
      const table = getTableRef('environmentalConditions');
      const existing = await executeDbOperation(async (db) => {
        const rows = await db.select({ id: table.id }).from(table).where(eq(table.code, data.code));
        return rows[0];
      });

      if (existing) {
        const updated = await updateEnvironmentalCondition(existing.id as number, condData);
        return successResponse(updated, 'Environmental condition updated (code existed)');
      }

      const condition = await createEnvironmentalCondition({ code: data.code, ...condData });
      return successResponse(condition, 'Environmental condition created successfully');
    } catch (error) {
      console.error('Error creating environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/environmental-conditions?id=X - Deactivate (soft delete)
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return errorResponse('Missing condition ID');
      }

      const existing = await getEnvironmentalConditionById(Number(id));
      if (!existing) {
        return errorResponse('Environmental condition not found');
      }

      const bomEnv = getTableRef('bOMEnvironmentalConditions');
      const refs = await executeDbOperation(async (db) => {
        return db.select({ id: bomEnv.id }).from(bomEnv).where(eq(bomEnv.conditionId, Number(id))).limit(1);
      });
      if (refs.length > 0) {
        return errorResponse('ไม่สามารถลบได้ เนื่องจากเงื่อนไขนี้ถูกใช้งานใน BOM Configuration กรุณาลบออกจาก BOM ก่อน');
      }

      const table = getTableRef('environmentalConditions');
      await executeDbOperation(async (db) => {
        await db.delete(table).where(eq(table.id, Number(id)));
      });

      return successResponse(null, 'Environmental condition deleted');
    } catch (error) {
      console.error('Error deactivating environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/environmental-conditions - Update environmental condition
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      if (!data.id) {
        return errorResponse('Missing condition ID');
      }

      const existing = await getEnvironmentalConditionById(data.id);
      if (!existing) {
        return errorResponse('Environmental condition not found');
      }

      // Validate temperature range
      const tempMin = data.temperatureMin ?? existing.temperatureMin;
      const tempMax = data.temperatureMax ?? existing.temperatureMax;
      if (tempMax <= tempMin) {
        return errorResponse('Temperature max must be greater than temperature min');
      }

      const condition = await updateEnvironmentalCondition(data.id, {
        code: data.code,
        name: data.name,
        temperatureMin: data.temperatureMin,
        temperatureMax: data.temperatureMax,
        humidityMax: data.humidityMax,
        monitoringIntervalMinutes: data.monitoringIntervalMinutes,
        notes: data.notes,
        isActive: data.isActive,
      });

      return successResponse(condition, 'Environmental condition updated successfully');
    } catch (error) {
      console.error('Error updating environmental condition:', error);
      return serverErrorResponse(error);
    }
  });
}
