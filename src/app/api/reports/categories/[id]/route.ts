import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
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
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

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
          createdAt: categoriesTable.createdAt,
          updatedAt: categoriesTable.updatedAt,
        })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, categoryId))
        .limit(1);
    });

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
    const { id } = await params;
    const categoryId = parseInt(id);
    const body = await request.json();

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const categoriesTable = getTableRef('reportCategories');

    // Verify category exists
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, categoryId))
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      updatedAt: dbDate(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.parentId !== undefined) updateData.parentId = body.parentId;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Update category
    await executeDbOperation(async (db) => {
      return db
        .update(categoriesTable)
        .set(updateData)
        .where(eq(categoriesTable.id, categoryId));
    });

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
    const { id } = await params;
    const categoryId = parseInt(id);

    if (isNaN(categoryId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const categoriesTable = getTableRef('reportCategories');
    const templatesTable = getTableRef('reportTemplates');

    // Verify category exists
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(eq(categoriesTable.id, categoryId))
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Check if category has templates
    const templatesInCategory = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.categoryId, categoryId))
        .limit(1);
    });

    if (templatesInCategory.length > 0) {
      // Soft delete - set isActive to false
      await executeDbOperation(async (db) => {
        return db
          .update(categoriesTable)
          .set({ isActive: false, updatedAt: dbDate() })
          .where(eq(categoriesTable.id, categoryId));
      });

      return NextResponse.json({
        success: true,
        message: 'Report category deactivated (has templates)',
      });
    }

    // Hard delete if no templates
    await executeDbOperation(async (db) => {
      return db.delete(categoriesTable).where(eq(categoriesTable.id, categoryId));
    });

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
