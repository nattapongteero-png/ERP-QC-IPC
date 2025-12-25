/**
 * Audit Statistics API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/statistics - Get audit statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditStatistics, getChapterCoverage } from '@/lib/services/internal-audit-service';
import { statisticsParamsSchema } from '@/lib/validation/internal-audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'audit:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = statisticsParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const year = parseResult.data.year;
    const statistics = await getAuditStatistics(year);
    const chapterCoverage = await getChapterCoverage(year);

    return NextResponse.json({
      success: true,
      data: {
        statistics,
        chapterCoverage,
      },
    });
  } catch (error) {
    console.error('Error fetching audit statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
