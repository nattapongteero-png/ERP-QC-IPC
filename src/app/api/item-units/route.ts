import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { mysqlItemUnits } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';

// GET /api/item-units - List all active units
export async function GET() {
  try {
    const db = await getDb();

    const units = await db
      .select()
      .from(mysqlItemUnits)
      .where(eq(mysqlItemUnits.isActive, true))
      .orderBy(asc(mysqlItemUnits.sortOrder));

    return successResponse(units);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-units GET');
  }
}

// POST /api/item-units - Create a new unit
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { code, nameTh, nameEn, symbol, description, sortOrder } = body;

    if (!code || !nameTh) {
      return NextResponse.json(
        { success: false, error: 'Code and Thai name are required' },
        { status: 400 }
      );
    }

    const result = await db.insert(mysqlItemUnits).values({
      code,
      nameTh,
      nameEn: nameEn || null,
      symbol: symbol || null,
      description: description || null,
      sortOrder: sortOrder || 0,
      isActive: true,
    });

    const insertId = result[0].insertId;

    const [newUnit] = await db
      .select()
      .from(mysqlItemUnits)
      .where(eq(mysqlItemUnits.id, insertId));

    return successResponse(newUnit);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-units POST');
  }
}
