import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef, getInsertId } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';
import { eq, asc, desc } from 'drizzle-orm';
import { calculateMinMax, validateSpecInputs } from '@/lib/utils/ipc-criteria-calc';
import { serializeAcceptanceStages } from '@/lib/master-data/ipc-stages';

function getTable() {
  return getTableRef('iPCCriteria');
}

// GET /api/master-data/ipc-criteria
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      const isActive = searchParams.get('isActive');

      const table = getTable();

      if (id) {
        const result = await executeDbOperation(async (db) => {
          return db.select().from(table).where(eq(table.id, Number(id)));
        });
        return successResponse(result[0] || null);
      }

      const result = await executeDbOperation(async (db) => {
        let query = db.select().from(table);
        const filterActive = (isActive !== null && isActive !== undefined && isActive !== '') ? isActive === 'true' : true;
        query = query.where(eq(table.isActive, filterActive));
        return query.orderBy(asc(table.code));
      });

      return successResponse(result);
    } catch (error) {
      console.error('Error fetching IPC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/ipc-criteria
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();

      // Auto-generate code if not provided
      if (!data.code) {
        const table = getTable();
        const latest = await executeDbOperation(async (db) => {
          const rows = await db.select({ code: table.code }).from(table).orderBy(desc(table.id)).limit(1);
          return rows[0]?.code as string | undefined;
        });
        const lastNum = latest ? parseInt(latest.replace(/\D/g, '') || '0') : 0;
        data.code = `IPC-${String(lastNum + 1).padStart(4, '0')}`;
      }

      if (!data.name) {
        return errorResponse('Name is required');
      }

      // When specTarget is provided, validate and auto-compute Min/Max
      let minValue = data.minValue ?? null;
      let maxValue = data.maxValue ?? null;
      let specTarget = data.specTarget ?? null;
      const specTolerancePercent = data.specTolerancePercent ?? 0;

      if (specTarget !== null && specTarget !== undefined && specTarget !== '') {
        const targetNum = Number(specTarget);
        const tolNum = Number(specTolerancePercent);
        const validationError = validateSpecInputs(targetNum, tolNum);
        if (validationError) {
          return errorResponse(validationError);
        }
        const calc = calculateMinMax(targetNum, tolNum);
        if (!calc) {
          return errorResponse('Invalid Target or Tolerance values');
        }
        specTarget = targetNum;
        minValue = calc.min;
        maxValue = calc.max;
      }

      // Stringify acceptanceStages array for storage. Empty/null = single-stage.
      // Validates shape so malformed data doesn't reach the DB.
      const acceptanceStages = serializeAcceptanceStages(data.acceptanceStages);

      const table = getTable();
      const ipcValues = {
        name: data.name, nameTh: data.nameTh || null, testMethod: data.testMethod || null,
        specification: data.specification || null, minValue, maxValue,
        unit: data.unit || null, sampleSize: data.sampleSize || 5, checkIntervalMinutes: data.checkIntervalMinutes || 30,
        isCritical: data.isCritical ?? false, isActive: data.isActive ?? true,
        dosageForm: data.dosageForm || null, criteriaType: data.criteriaType || 'numeric',
        tolerancePercent: data.tolerancePercent ?? 0,
        specTarget, specTolerancePercent,
        acceptanceStages,
      };

      // Upsert
      const existing = await executeDbOperation(async (db) => {
        const rows = await db.select({ id: table.id }).from(table).where(eq(table.code, data.code));
        return rows[0];
      });

      if (existing) {
        await executeDbOperation(async (db) => {
          return db.update(table).set(ipcValues).where(eq(table.id, existing.id as number));
        });
        const [updated] = await executeDbOperation(async (db) => {
          return db.select().from(table).where(eq(table.id, existing.id as number));
        });
        return successResponse(updated, 'IPC criteria updated (code existed)');
      }

      const result = await executeDbOperation(async (db) => {
        return db.insert(table).values({ code: data.code, ...ipcValues, createdAt: getNow() } as any);
      });
      const insertId = getInsertId(result);
      const [created] = await executeDbOperation(async (db) => {
        return db.select().from(table).where(eq(table.id, insertId));
      });

      return successResponse(created, 'IPC criteria created successfully');
    } catch (error) {
      console.error('Error creating IPC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/ipc-criteria?id=X - Deactivate
export async function DELETE(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');
      if (!id) return errorResponse('Missing ID');

      const bomIpc = getTableRef('bOMInProcessQC');
      const refs = await executeDbOperation(async (db) => {
        return db.select({ id: bomIpc.id }).from(bomIpc).where(eq(bomIpc.criteriaId, Number(id))).limit(1);
      });
      if (refs.length > 0) {
        return errorResponse('ไม่สามารถลบได้ เนื่องจากเกณฑ์ IPC นี้ถูกใช้งานใน BOM Configuration กรุณาลบออกจาก BOM ก่อน');
      }

      const table = getTable();
      await executeDbOperation(async (db) => {
        await db.delete(table).where(eq(table.id, Number(id)));
      });
      return successResponse(null, 'IPC criteria deleted');
    } catch (error) {
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/ipc-criteria
export async function PUT(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();
      if (!data.id) return errorResponse('Missing criteria ID');

      const table = getTable();
      const updateData: Record<string, unknown> = {};

      const fields = [
        'code', 'name', 'nameTh', 'testMethod', 'specification', 'minValue', 'maxValue',
        'unit', 'sampleSize', 'checkIntervalMinutes', 'isCritical', 'isActive',
        'dosageForm', 'criteriaType', 'tolerancePercent',
        'specTarget', 'specTolerancePercent',
      ];
      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
      }

      // Serialize stages independently so empty/null clears multi-stage cleanly
      if (data.acceptanceStages !== undefined) {
        updateData.acceptanceStages = serializeAcceptanceStages(data.acceptanceStages);
      }

      // When specTarget is touched, validate and recompute minValue/maxValue
      if (updateData.specTarget !== undefined && updateData.specTarget !== null && updateData.specTarget !== '') {
        const targetNum = Number(updateData.specTarget);
        const tolNum = Number(updateData.specTolerancePercent ?? 0);
        const validationError = validateSpecInputs(targetNum, tolNum);
        if (validationError) {
          return errorResponse(validationError);
        }
        const calc = calculateMinMax(targetNum, tolNum);
        if (!calc) {
          return errorResponse('Invalid Target or Tolerance values');
        }
        updateData.specTarget = targetNum;
        updateData.specTolerancePercent = tolNum;
        updateData.minValue = calc.min;
        updateData.maxValue = calc.max;
      }

      await executeDbOperation(async (db) => {
        return db.update(table).set(updateData as any).where(eq(table.id, data.id));
      });

      const [updated] = await executeDbOperation(async (db) => {
        return db.select().from(table).where(eq(table.id, data.id));
      });

      return successResponse(updated, 'IPC criteria updated successfully');
    } catch (error) {
      console.error('Error updating IPC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}
