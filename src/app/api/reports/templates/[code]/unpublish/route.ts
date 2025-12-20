import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/reports/templates/[code]/unpublish
 * Unpublishes a report template (sets isPublished to false)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDb();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isSqlite = useSqlite();
    const { code } = await params;

    const templatesTable = isSqlite
      ? schema.sqliteReportTemplates
      : schema.mysqlReportTemplates;

    // Verify template exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (db as any)
      .select({
        id: templatesTable.id,
        isPublished: templatesTable.isPublished,
        isSystem: templatesTable.isSystem,
      })
      .from(templatesTable)
      .where(eq(templatesTable.code, code))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Report template not found' },
        { status: 404 }
      );
    }

    if (!existing[0].isPublished) {
      return NextResponse.json({
        success: true,
        message: 'Report template is already unpublished',
      });
    }

    // Check if it's a system template - system templates cannot be unpublished
    if (existing[0].isSystem) {
      return NextResponse.json(
        { success: false, error: 'System templates cannot be unpublished' },
        { status: 403 }
      );
    }

    // Unpublish template
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(templatesTable)
      .set({
        isPublished: false,
        updatedAt: new Date(),
      })
      .where(eq(templatesTable.code, code));

    return NextResponse.json({
      success: true,
      message: 'Report template unpublished successfully',
    });
  } catch (error) {
    console.error('Report template unpublish error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unpublish report template' },
      { status: 500 }
    );
  }
}
