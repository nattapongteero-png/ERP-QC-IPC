import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getInsertId } from '@/lib/db/db-helper';
import { successResponse, serverErrorResponse } from '@/lib/api-utils';

// GET /api/item-categories - List all active categories
export async function GET() {
  try {
    const itemCategoriesTable = getTableRef('itemCategories');

    const categories = await executeDbOperation(async (db) => {
      return db
        .select()
        .from(itemCategoriesTable)
        .where(eq(itemCategoriesTable.isActive, true))
        .orderBy(asc(itemCategoriesTable.sortOrder));
    });

    return successResponse(categories);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-categories GET');
  }
}

// POST /api/item-categories - Create a new category
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, nameTh, nameEn, description, sortOrder } = body;

    if (!code || !nameTh) {
      return NextResponse.json(
        { success: false, error: 'Code and Thai name are required' },
        { status: 400 }
      );
    }

    const itemCategoriesTable = getTableRef('itemCategories');

    const result = await executeDbOperation(async (db) => {
      return db.insert(itemCategoriesTable).values({
        code,
        nameTh,
        nameEn: nameEn || null,
        description: description || null,
        sortOrder: sortOrder || 0,
        isActive: true,
      });
    });

    const insertId = getInsertId(result);

    const newCategory = await executeDbOperation(async (db) => {
      const [category] = await db
        .select()
        .from(itemCategoriesTable)
        .where(eq(itemCategoriesTable.id, insertId));
      return category;
    });

    return successResponse(newCategory);
  } catch (error) {
    return serverErrorResponse(error, '/api/item-categories POST');
  }
}
