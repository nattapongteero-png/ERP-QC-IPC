import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/categories
 * Returns list of report categories
 */
export async function GET() {
  try {
    const categoriesTable = getTableRef('reportCategories');

    const results = await executeDbOperation(async (db) => {
      return db
        .select({
          id: categoriesTable.id,
          name: categoriesTable.name,
          description: categoriesTable.description,
          parentId: categoriesTable.parentId,
          sortOrder: categoriesTable.sortOrder,
          isActive: categoriesTable.isActive,
        })
        .from(categoriesTable)
        .where(eq(categoriesTable.isActive, true))
        .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name));
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Report categories list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/categories
 * Creates a new report category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const categoriesTable = getTableRef('reportCategories');

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Category name is required' },
        { status: 400 }
      );
    }

    // Prepare insert data
    const insertData = {
      name: body.name,
      description: body.description || null,
      parentId: body.parentId || null,
      sortOrder: body.sortOrder || 0,
      isActive: body.isActive ?? true,
      createdAt: dbDate(),
      updatedAt: dbDate(),
    };

    // Insert category
    const result = await executeDbOperation(async (db) => {
      return db.insert(categoriesTable).values(insertData);
    });

    const insertedId = getInsertId(result);

    return NextResponse.json({
      success: true,
      message: 'Report category created successfully',
      data: {
        id: insertedId,
        name: body.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Report category create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create report category' },
      { status: 500 }
    );
  }
}
