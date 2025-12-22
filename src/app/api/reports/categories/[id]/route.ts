import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reports/categories/[id]
 * Returns a single report category by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

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
        createdAt: categoriesTable.createdAt,
        updatedAt: categoriesTable.updatedAt,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);

    if (results.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: results[0],
    });
  } catch (error) {
    console.error('Report category fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report category' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reports/categories/[id]
 * Updates an existing report category
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const categoriesTable = isSqlite
      ? schema.sqliteReportCategories
      : schema.mysqlReportCategories;

    // Verify category exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any)
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Update category
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, categoryId));

    return NextResponse.json({
      success: true,
      message: 'Report category updated successfully',
    });
  } catch (error) {
    console.error('Report category update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update report category' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/categories/[id]
 * Deletes a report category (sets isActive to false or hard delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const categoriesTable = isSqlite
      ? schema.sqliteReportCategories
      : schema.mysqlReportCategories;
    const templatesTable = isSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;

    // Verify category exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any)
      .select({ id: categoriesTable.id })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category has templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templatesInCategory = await (db as any)
      .select({ id: templatesTable.id })
      .from(templatesTable)
      .where(eq(templatesTable.categoryId, categoryId))
      .limit(1);

    if (templatesInCategory.length > 0) {
      // Soft delete - set isActive to false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(categoriesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(categoriesTable.id, categoryId));

      return NextResponse.json({
        success: true,
        message: 'Report category deactivated (has templates)',
      });
    }

    // Hard delete if no templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, categoryId));

    return NextResponse.json({
      success: true,
      message: 'Report category deleted successfully',
    });
  } catch (error) {
    console.error('Report category delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete report category' },
      { status: 500 }
    );
  }
}
