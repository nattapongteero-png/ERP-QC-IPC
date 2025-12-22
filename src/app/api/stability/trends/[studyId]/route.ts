/**
 * Stability Study Trends API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * GET /api/stability/trends/[studyId] - Get study-specific trend data with projections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStudyTrendData } from '@/lib/services/stability-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studyId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { studyId } = await params;
    const id = parseInt(studyId, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid study ID' },
        { status: 400 }
      );
    }

    const trends = await getStudyTrendData(id);
    if (!trends) {
      return NextResponse.json(
        { success: false, error: 'Study not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error fetching study trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch study trends' },
      { status: 500 }
    );
  }
}
