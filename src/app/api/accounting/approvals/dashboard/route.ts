/**
 * Approval Dashboard API (T126)
 * GET /api/accounting/approvals/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getApprovalDashboard } from '@/lib/services/approval-workflow.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      // TODO: Get actual user ID from session
      const userId = session.userId;

      const dashboard = await getApprovalDashboard(userId);
      return NextResponse.json({ success: true, data: dashboard });
    } catch (error) {
      console.error('Error fetching approval dashboard:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
