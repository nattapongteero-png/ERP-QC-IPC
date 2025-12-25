import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/reports/templates/[code]/publish
 * Publishes a report template (sets isPublished to true)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { code } = await params;

    const templatesTable = getTableRef('reportTemplates');

    // Verify template exists
    const existing = await executeDbOperation(async (db) => {
      return db
        .select({
          id: templatesTable.id,
          isPublished: templatesTable.isPublished,
          definition: templatesTable.definition,
        })
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

    if (existing[0].isPublished) {
      return NextResponse.json({
        success: true,
        message: 'Report template is already published',
      });
    }

    // Validate template has a valid definition before publishing
    if (!existing[0].definition || existing[0].definition.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Cannot publish a template without a report definition' },
        { status: 400 }
      );
    }

    // Publish template
    await executeDbOperation(async (db) => {
      return db
        .update(templatesTable)
        .set({
          isPublished: true,
          updatedAt: dbDate(),
        })
        .where(eq(templatesTable.code, code));
    });

    return NextResponse.json({
      success: true,
      message: 'Report template published successfully',
    });
  } catch (error) {
    console.error('Report template publish error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to publish report template' },
      { status: 500 }
    );
  }
}
