import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/categories
 * Returns list of report categories
 */
export async function GET() {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = useSqlite();

    const categoriesTable = isSqlite
      ? schema.sqliteReportCategories
      : schema.mysqlReportCategories;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = await (db as any)
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
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = useSqlite();
    const body = await request.json();

    const categoriesTable = isSqlite
      ? schema.sqliteReportCategories
      : schema.mysqlReportCategories;

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
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(categoriesTable)
      .values(insertData);

    const insertedId = isSqlite ? result.lastInsertRowid : result[0].insertId;

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
