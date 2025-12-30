/**
 * Approval Dashboard API (T126)
 * GET /api/accounting/approvals/dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApprovalDashboard } from '@/lib/services/approval-workflow.service';

export async function GET(request: NextRequest) {
  try {
    // TODO: Get actual user ID from session
    const userId = 1;

    const dashboard = await getApprovalDashboard(userId);
    return NextResponse.json({ success: true, data: dashboard });
  } catch (error) {
    console.error('Error fetching approval dashboard:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
