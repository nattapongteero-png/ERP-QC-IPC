/**
 * RM Summary API Endpoint
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T040)
 *
 * GET /api/dashboard/rm-summary - Returns detailed RM received YTD (FR-047)
 */

import { NextResponse } from 'next/server';
import { getRmReceivedYtd, getRmStatusBreakdown } from '@/lib/services/audit-dashboard-service';

export async function GET() {
  try {
    const [rmReceivedYtd, rmStatusBreakdown] = await Promise.all([
      getRmReceivedYtd(),
      getRmStatusBreakdown(),
    ]);

    return NextResponse.json({
      ytd: rmReceivedYtd,
      status: rmStatusBreakdown,
    });
  } catch (error) {
    console.error('Error fetching RM summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch RM summary' },
      { status: 500 }
    );
  }
}
