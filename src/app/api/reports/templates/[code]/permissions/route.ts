import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
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
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { code } = await params;

    const templatesTable = isSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;
    const permissionsTable = isSqlite
      ? schema.sqliteReportPermissions
      : schema.mysqlReportPermissions;

    // Get template ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({ id: templatesTable.id })
      .from(templatesTable)
      .where(eq(templatesTable.code, code))
      .limit(1);

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const templateId = templates[0].id;

    // Get permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permissions = await (db as any)
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
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { code } = await params;
    const body = await request.json();

    const templatesTable = isSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;
    const permissionsTable = isSqlite
      ? schema.sqliteReportPermissions
      : schema.mysqlReportPermissions;

    // Get template ID
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({ id: templatesTable.id })
      .from(templatesTable)
      .where(eq(templatesTable.code, code))
      .limit(1);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any)
      .select({ id: permissionsTable.id })
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.templateId, templateId),
          eq(permissionsTable.role, body.role)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing permission
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as any)
        .update(permissionsTable)
        .set({
          canView: body.canView ?? true,
          canDesign: body.canDesign ?? false,
          canExport: body.canExport ?? true,
        })
        .where(eq(permissionsTable.id, existing[0].id));

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
      createdAt: new Date(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (db as any)
      .insert(permissionsTable)
      .values(insertData);

    const insertedId = isSqlite ? result.lastInsertRowid : result[0].insertId;

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
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = isSqlite();
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const permissionId = searchParams.get('id');

    if (!permissionId) {
      return NextResponse.json(
        { success: false, error: 'Permission ID is required' },
        { status: 400 }
      );
    }

    const templatesTable = isSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;
    const permissionsTable = isSqlite
      ? schema.sqliteReportPermissions
      : schema.mysqlReportPermissions;

    // Verify template exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates = await (db as any)
      .select({ id: templatesTable.id })
      .from(templatesTable)
      .where(eq(templatesTable.code, code))
      .limit(1);

    if (templates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    const templateId = templates[0].id;

    // Verify permission belongs to this template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any)
      .select({ id: permissionsTable.id })
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.id, parseInt(permissionId)),
          eq(permissionsTable.templateId, templateId)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Permission not found' },
        { status: 404 }
      );
    }

    // Delete permission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .delete(permissionsTable)
      .where(eq(permissionsTable.id, parseInt(permissionId)));

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
