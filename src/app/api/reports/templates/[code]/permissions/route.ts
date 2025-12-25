import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * GET /api/reports/templates/[code]/permissions
 * Returns permissions for a report template
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const templatesTable = getTableRef('reportTemplates');
    const permissionsTable = getTableRef('reportPermissions');

    // Get template ID
    const templates = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const templateId = templates[0].id;

    // Get permissions
    const permissions = await executeDbOperation(async (db) => {
      return db
        .select({
          id: permissionsTable.id,
          templateId: permissionsTable.templateId,
          role: permissionsTable.role,
          canView: permissionsTable.canView,
          canDesign: permissionsTable.canDesign,
          canExport: permissionsTable.canExport,
          createdAt: permissionsTable.createdAt,
        })
        .from(permissionsTable)
        .where(eq(permissionsTable.templateId, templateId));
    });

    return NextResponse.json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    console.error('Report permissions fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch report permissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/templates/[code]/permissions
 * Creates or updates a permission for a report template
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const body = await request.json();

    const templatesTable = getTableRef('reportTemplates');
    const permissionsTable = getTableRef('reportPermissions');

    // Get template ID
    const templates = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const templateId = templates[0].id;

    // Validate that role is provided
    if (!body.role) {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      );
    }

    // Check if permission already exists for this role
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: permissionsTable.id })
        .from(permissionsTable)
        .where(
          and(
            eq(permissionsTable.templateId, templateId),
            eq(permissionsTable.role, body.role)
          )
        )
        .limit(1);
    });

    if (existing.length > 0) {
      // Update existing permission
      await executeDbOperation(async (db) => {
        return db
          .update(permissionsTable)
          .set({
            canView: body.canView ?? true,
            canDesign: body.canDesign ?? false,
            canExport: body.canExport ?? true,
          })
          .where(eq(permissionsTable.id, existing[0].id));
      });

      return NextResponse.json({
        success: true,
        message: 'Permission updated successfully',
      });
    }

    // Create new permission
    const insertData = {
      templateId,
      role: body.role,
      canView: body.canView ?? true,
      canDesign: body.canDesign ?? false,
      canExport: body.canExport ?? true,
      createdAt: dbDate(),
    };

    const result = await executeDbOperation(async (db) => {
      return db.insert(permissionsTable).values(insertData);
    });

    const insertedId = getInsertId(result);

    return NextResponse.json({
      success: true,
      message: 'Permission created successfully',
      data: { id: insertedId },
    }, { status: 201 });
  } catch (error) {
    console.error('Report permission create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create report permission' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/templates/[code]/permissions
 * Deletes a permission by ID (passed in query string)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('id');

    if (!permissionId) {
      return NextResponse.json(
        { success: false, error: 'Permission ID is required' },
        { status: 400 }
      );
    }

    const templatesTable = getTableRef('reportTemplates');
    const permissionsTable = getTableRef('reportPermissions');

    // Verify template exists
    const templates = await executeDbOperation(async (db) => {
      return db
        .select({ id: templatesTable.id })
        .from(templatesTable)
        .where(eq(templatesTable.code, code))
        .limit(1);
    });

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const templateId = templates[0].id;

    // Verify permission belongs to this template
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({ id: permissionsTable.id })
        .from(permissionsTable)
        .where(
          and(
            eq(permissionsTable.id, parseInt(permissionId)),
            eq(permissionsTable.templateId, templateId)
          )
        )
        .limit(1);
    });

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Permission not found' },
        { status: 404 }
      );
    }

    // Delete permission
    await executeDbOperation(async (db) => {
      return db
        .delete(permissionsTable)
        .where(eq(permissionsTable.id, parseInt(permissionId)));
    });

    return NextResponse.json({
      success: true,
      message: 'Permission deleted successfully',
    });
  } catch (error) {
    console.error('Report permission delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete report permission' },
      { status: 500 }
    );
  }
}
