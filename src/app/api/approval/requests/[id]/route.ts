/**
 * API Route: Single Approval Request (T019)
 * GET /api/approval/requests/[id] - Get approval request details
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getApprovalRequestById } from '@/lib/services/approval-workflow.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const requestId = parseInt(id, 10);

      if (isNaN(requestId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid request ID' },
          { status: 400 }
        );
      }

      const approvalRequest = await getApprovalRequestById(requestId);

      if (!approvalRequest) {
        return NextResponse.json(
          { success: false, error: 'Approval request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: approvalRequest,
      });
    } catch (error) {
      console.error('Error getting approval request:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get approval request' },
        { status: 500 }
      );
    }

  });
}
