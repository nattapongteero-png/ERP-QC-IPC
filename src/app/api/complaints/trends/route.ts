/**
 * Complaints Trends API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/complaints/trends - Get complaint trend analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getComplaintTrends } from '@/lib/services/complaint-service';
import { complaintTrendsParamsSchema } from '@/lib/validation/complaints';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      period: searchParams.get('period') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
    };

    // Validate parameters
    const parseResult = complaintTrendsParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    console.log('[DEBUG] Calling getComplaintTrends with:', parseResult.data);
    const trends = await getComplaintTrends(parseResult.data);
    console.log('[DEBUG] Got trends:', JSON.stringify(trends, null, 2));

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error fetching complaint trends:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
