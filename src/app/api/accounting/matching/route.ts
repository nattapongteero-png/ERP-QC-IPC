/**
 * Matching Dashboard API (T110)
 * GET /api/accounting/matching - Get matching summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getMatchingSummary } from '@/lib/services/matching.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const summary = await getMatchingSummary();
      return NextResponse.json({ success: true, data: summary });
    } catch (error) {
      console.error('Error getting matching summary:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
