import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';

// GET /api/item-units - List all active units
export async function GET() {
  try {
    const itemUnitsTable = getTableRef('itemUnits');

    const units = await executeDbOperation(async (db) => {
      return db
        .select()
        .from(itemUnitsTable)
        .where(eq(itemUnitsTable.isActive, true))
        .orderBy(asc(itemUnitsTable.sortOrder));
    });

    return successResponse(units);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-units GET');
  }
}

// POST /api/item-units - Create a new unit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, nameTh, nameEn, symbol, description, sortOrder } = body;

    if (!code || !nameTh) {
      return NextResponse.json(
        { success: false, error: 'Code and Thai name are required' },
        { status: 400 }
      );
    }

    const itemUnitsTable = getTableRef('itemUnits');

    const result = await executeDbOperation(async (db) => {
      return db.insert(itemUnitsTable).values({
        code,
        nameTh,
        nameEn: nameEn || null,
        symbol: symbol || null,
        description: description || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      });
    });

    const insertId = getInsertId(result);

    const newUnit = await executeDbOperation(async (db) => {
      const [unit] = await db
        .select()
        .from(itemUnitsTable)
        .where(eq(itemUnitsTable.id, insertId));
      return unit;
    });

    return successResponse(newUnit);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-units POST');
  }
}
