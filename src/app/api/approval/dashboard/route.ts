/**
 * API Route: Approval Dashboard (T024)
 * GET /api/approval/dashboard - Get dashboard data for approver
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getApprovalDashboard } from '@/lib/services/approval-workflow.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      // TODO: Get actual user ID from session
      const approverId = session.userId;

      if (isNaN(approverId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid approver ID' },
          { status: 400 }
        );
      }

      const dashboard = await getApprovalDashboard(approverId);

      return NextResponse.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error getting approval dashboard:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get approval dashboard' },
        { status: 500 }
      );
    }

  });
}
