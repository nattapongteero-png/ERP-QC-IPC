/**
 * RM Summary API Endpoint
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US11 - T040)
 *
 * GET /api/dashboard/rm-summary - Returns detailed RM received YTD (FR-047)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRmReceivedYtd, getRmStatusBreakdown } from '@/lib/services/audit-dashboard-service';
import { withAuth } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  // Exposes raw-material inventory detail. This previously had no auth of any
  // kind and was readable by any anonymous caller.
  return withAuth(
    request,
    async () => {
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
    },
    ['reports:read']
  );
}
