import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import { eq, and, like, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/templates
 * Returns list of report templates with optional filtering
 * Query params:
 *   - categoryId: Filter by category
 *   - isPublished: Filter by publish status (true/false)
 *   - search: Search in name and description
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const categoryId = searchParams.get('categoryId');
    const isPublished = searchParams.get('isPublished');
    const search = searchParams.get('search');

    const templatesTable = getTableRef('reportTemplates');
    const categoriesTable = getTableRef('reportCategories');

    // Build conditions
    const conditions: (SQL | undefined)[] = [];

    if (categoryId) {
      conditions.push(eq(templatesTable.categoryId, parseInt(categoryId)));
    }

    if (isPublished !== null && isPublished !== undefined) {
      const publishedValue = isPublished === 'true';
      conditions.push(eq(templatesTable.isPublished, publishedValue));
    }

    if (search) {
      conditions.push(like(templatesTable.name, `%${search}%`));
    }

    // Query templates with category info
    const results = await executeDbOperation(async (db) => {
      return db
        .select({
          id: templatesTable.id,
          name: templatesTable.name,
          description: templatesTable.description,
          code: templatesTable.code,
          categoryId: templatesTable.categoryId,
          categoryName: categoriesTable.name,
          version: templatesTable.version,
          isPublished: templatesTable.isPublished,
          isSystem: templatesTable.isSystem,
          thumbnail: templatesTable.thumbnail,
          createdAt: templatesTable.createdAt,
          updatedAt: templatesTable.updatedAt,
        })
        .from(templatesTable)
        .leftJoin(categoriesTable, eq(templatesTable.categoryId, categoriesTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(templatesTable.name);
    });

    return NextResponse.json({
      success: true,
      data: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Report templates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/templates
 * Creates a new report template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const templatesTable = getTableRef('reportTemplates');

    // Validate required fields
    if (!body.name || !body.code || !body.definition) {
      return NextResponse.json(
        { success: false, error: 'Name, code, and definition are required' },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.code, body.code))
        .limit(1);
    });

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A template with this code already exists' },
        { status: 409 }
      );
    }

    // Prepare insert data
    const insertData = {
      name: body.name,
      description: body.description || null,
      code: body.code,
      categoryId: body.categoryId || null,
      definition: body.definition,
      dataSourceConfig: body.dataSourceConfig
        ? JSON.stringify(body.dataSourceConfig)
        : null,
      parametersSchema: body.parametersSchema
        ? JSON.stringify(body.parametersSchema)
        : null,
      version: 1,
      isPublished: body.isPublished || false,
      isSystem: body.isSystem || false,
      thumbnail: body.thumbnail || null,
      createdBy: body.createdBy || 1, // Default to admin user
      createdAt: dbDate(),
      updatedAt: dbDate(),
    };

    // Insert template
    const result = await executeDbOperation(async (db) => {
      return db.insert(templatesTable).values(insertData);
    });

    const insertedId = getInsertId(result);

    return NextResponse.json({
      success: true,
      message: 'Report template created successfully',
      data: {
        id: insertedId,
        code: body.code,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Report template create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create report template' },
      { status: 500 }
    );
  }
}
