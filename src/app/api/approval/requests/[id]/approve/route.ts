/**
 * API Route: Approve Request (T020)
 * POST /api/approval/requests/[id]/approve - Approve an approval request
 */

import { NextRequest, NextResponse } from 'next/server';
import { approveRequest } from '@/lib/services/approval-workflow.service';
import { approvalApproveSchema } from '@/lib/validation/approval-workflow';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid request ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = approvalApproveSchema.parse(body);

    // TODO: Get actual user ID from session
    const approverId = body.approverId ?? 1;

    await approveRequest(requestId, approverId, data.comments);

    return NextResponse.json({
      success: true,
      message: 'Request approved successfully',
    });
  } catch (error) {
    console.error('Error approving request:', error);

    if (error instanceof Error) {
      if (error.message.startsWith('NOT_AUTHORIZED')) {
        return NextResponse.json(
          { success: false, error: error.message.split(': ')[1] },
          { status: 403 }
        );
      }
      if (error.message.startsWith('ALREADY_PROCESSED')) {
        return NextResponse.json(
          { success: false, error: error.message.split(': ')[1] },
          { status: 400 }
        );
      }
      if (error.message.startsWith('INVALID_REQUEST')) {
        return NextResponse.json(
          { success: false, error: error.message.split(': ')[1] },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}
