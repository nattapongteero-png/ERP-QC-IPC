/**
 * QC Summary API
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T089)
 *
 * GET: Get QC test summary statistics (FR-051)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { getQCSummary } from '@/lib/services/qc-disposition.service';

/**
 * GET /api/quality/qc-summary
 * Get QC test summary statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const summary = await getQCSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching QC summary:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch QC summary' },
      { status: 500 }
    );
  }
}
