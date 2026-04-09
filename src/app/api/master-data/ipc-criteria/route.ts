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

      const table = getTable();
      const result = await executeDbOperation(async (db) => {
        return db.insert(table).values({
          code: data.code,
          name: data.name,
          nameTh: data.nameTh || null,
          testMethod: data.testMethod || null,
          specification: data.specification || null,
          minValue: data.minValue ?? null,
          maxValue: data.maxValue ?? null,
          unit: data.unit || null,
          sampleSize: data.sampleSize || 5,
          checkIntervalMinutes: data.checkIntervalMinutes || 30,
          isCritical: data.isCritical ?? false,
          isActive: data.isActive ?? true,
          dosageForm: data.dosageForm || null,
          criteriaType: data.criteriaType || 'numeric',
          tolerancePercent: data.tolerancePercent ?? 0,
          createdAt: getNow(),
        } as any);
      });

      const insertId = getInsertId(result);
      const [created] = await executeDbOperation(async (db) => {
        return db.select().from(table).where(eq(table.id, insertId));
      });

      return successResponse(created, 'IPC criteria created successfully');
    } catch (error) {
      console.error('Error creating IPC criteria:', error);
      const errMsg = String((error as Error).message || '') + String((error as any).cause?.message || '');
      if (errMsg.includes('UNIQUE constraint') || errMsg.includes('Duplicate entry')) {
        return errorResponse('Criteria code already exists');
      }
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

      const fields = ['code', 'name', 'nameTh', 'testMethod', 'specification', 'minValue', 'maxValue', 'unit', 'sampleSize', 'checkIntervalMinutes', 'isCritical', 'isActive', 'dosageForm', 'criteriaType', 'tolerancePercent'];
      for (const field of fields) {
        if (data[field] !== undefined) updateData[field] = data[field];
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
