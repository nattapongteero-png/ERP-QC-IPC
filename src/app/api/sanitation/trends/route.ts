/**
 * Sanitation Trends API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/trends - Get sanitation trends and statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getSanitationTrends } from '@/lib/services/sanitation-service';
import { trendsParamsSchema } from '@/lib/validation/sanitation';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = trendsParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const trends = await getSanitationTrends(parseResult.data);

    return NextResponse.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching sanitation trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
