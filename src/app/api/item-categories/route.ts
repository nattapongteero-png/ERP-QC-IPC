import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { mysqlItemCategories } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';

// GET /api/item-categories - List all active categories
export async function GET() {
  try {
    const db = await getDb();

    const categories = await db
      .select()
      .from(mysqlItemCategories)
      .where(eq(mysqlItemCategories.isActive, true))
      .orderBy(asc(mysqlItemCategories.sortOrder));

    return successResponse(categories);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-categories GET');
  }
}

// POST /api/item-categories - Create a new category
export async function POST(request: Request) {
  try {
    const db = await getDb();
    const body = await request.json();

    const { code, nameTh, nameEn, description, sortOrder } = body;

    if (!code || !nameTh) {
      return NextResponse.json(
        { success: false, error: 'Code and Thai name are required' },
        { status: 400 }
      );
    }

    const result = await db.insert(mysqlItemCategories).values({
      code,
      nameTh,
      nameEn: nameEn || null,
      description: description || null,
      sortOrder: sortOrder || 0,
      isActive: true,
    });

    const insertId = result[0].insertId;

    const [newCategory] = await db
      .select()
      .from(mysqlItemCategories)
      .where(eq(mysqlItemCategories.id, insertId));

    return successResponse(newCategory);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-categories POST');
  }
}
