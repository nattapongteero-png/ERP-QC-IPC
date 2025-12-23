import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/reports/templates/[code]
 * Returns a single report template by code
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const templatesTable = getTableRef('reportTemplates');
    const categoriesTable = getTableRef('reportCategories');

    // Query template by code
    const results = await executeDbOperation(async (db) => {
      return db
        .select({
          id: templatesTable.id,
          name: templatesTable.name,
          description: templatesTable.description,
          code: templatesTable.code,
          categoryId: templatesTable.categoryId,
          categoryName: categoriesTable.name,
          definition: templatesTable.definition,
          dataSourceConfig: templatesTable.dataSourceConfig,
          parametersSchema: templatesTable.parametersSchema,
          version: templatesTable.version,
          isPublished: templatesTable.isPublished,
          isSystem: templatesTable.isSystem,
          thumbnail: templatesTable.thumbnail,
          createdBy: templatesTable.createdBy,
          createdAt: templatesTable.createdAt,
          updatedBy: templatesTable.updatedBy,
          updatedAt: templatesTable.updatedAt,
        })
        .from(templatesTable)
        .leftJoin(categoriesTable, eq(templatesTable.categoryId, categoriesTable.id))
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const template = results[0];

    // Parse JSON fields
    const templateData = {
      ...template,
      dataSourceConfig: template.dataSourceConfig
        ? JSON.parse(template.dataSourceConfig)
        : null,
      parametersSchema: template.parametersSchema
        ? JSON.parse(template.parametersSchema)
        : null,
    };

    return NextResponse.json({
      success: true,
      data: templateData,
    });
  } catch (error) {
    console.error('Report template fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/templates/[code]
 * Updates an existing report template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const body = await request.json();

    const templatesTable = getTableRef('reportTemplates');

    // Verify template exists
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id, version: templatesTable.version })
        .from(templatesTable)
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: dbDate(),
      version: existing[0].version + 1,
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
    if (body.definition !== undefined) updateData.definition = body.definition;
    if (body.dataSourceConfig !== undefined) {
      updateData.dataSourceConfig = JSON.stringify(body.dataSourceConfig);
    }
    if (body.parametersSchema !== undefined) {
      updateData.parametersSchema = JSON.stringify(body.parametersSchema);
    }
    if (body.isPublished !== undefined) updateData.isPublished = body.isPublished;
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail;
    if (body.updatedBy !== undefined) updateData.updatedBy = body.updatedBy;

    // Update template
    await executeDbOperation(async (db) => {
      return db
        .update(templatesTable)
        .set(updateData)
        .where(eq(templatesTable.code, code));
    });

    return NextResponse.json({
      success: true,
      message: 'Report template updated successfully',
      version: updateData.version,
    });
  } catch (error) {
    console.error('Report template update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update report template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/templates/[code]
 * Deletes a report template (soft delete by setting isPublished to false, or hard delete for non-system templates)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const templatesTable = getTableRef('reportTemplates');

    // Verify template exists and check if it's a system template
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id, isSystem: templatesTable.isSystem })
        .from(templatesTable)
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    if (existing[0].isSystem) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be deleted' },
        { status: 403 }
      );
    }

    // Delete template
    await executeDbOperation(async (db) => {
      return db.delete(templatesTable).where(eq(templatesTable.code, code));
    });

    return NextResponse.json({
      success: true,
      message: 'Report template deleted successfully',
    });
  } catch (error) {
    console.error('Report template delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete report template' },
      { status: 500 }
    );
  }
}
