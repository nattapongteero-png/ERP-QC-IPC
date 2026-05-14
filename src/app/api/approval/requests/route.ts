/**
 * API Route: Approval Requests List (T018)
 * GET /api/approval/requests - List approval requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listApprovalRequests } from '@/lib/services/approval-workflow.service';
import { approvalRequestQuerySchema } from '@/lib/validation/approval-workflow';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = approvalRequestQuerySchema.parse({
        documentType: searchParams.get('documentType'),
        status: searchParams.get('status'),
        requestedBy: searchParams.get('requestedBy'),
        assignedTo: searchParams.get('assignedTo'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const result = await listApprovalRequests(query);

      return NextResponse.json({
        success: true,
        data: result.data,
        total: result.total,
        page: query.page,
        limit: query.limit,
      });
    } catch (error) {
      console.error('Error listing approval requests:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to list approval requests' },
        { status: 500 }
      );
    }

  });
}
