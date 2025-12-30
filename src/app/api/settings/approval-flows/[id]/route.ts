/**
 * API Route: Single Approval Flow (T014)
 * GET /api/settings/approval-flows/[id] - Get approval flow details
 * PUT /api/settings/approval-flows/[id] - Update approval flow
 * DELETE /api/settings/approval-flows/[id] - Delete approval flow
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApprovalFlowById,
  updateApprovalFlow,
  deleteApprovalFlow,
} from '@/lib/services/approval-workflow.service';
import { approvalFlowUpdateSchema } from '@/lib/validation/approval-workflow';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const flowId = parseInt(id, 10);

    if (isNaN(flowId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid flow ID' },
        { status: 400 }
      );
    }

    const flow = await getApprovalFlowById(flowId);

    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'Approval flow not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: flow,
    });
  } catch (error) {
    console.error('Error getting approval flow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get approval flow' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const flowId = parseInt(id, 10);

    if (isNaN(flowId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid flow ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = approvalFlowUpdateSchema.parse(body);

    await updateApprovalFlow(flowId, data);

    return NextResponse.json({
      success: true,
      message: 'Approval flow updated successfully',
    });
  } catch (error) {
    console.error('Error updating approval flow:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update approval flow' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const flowId = parseInt(id, 10);

    if (isNaN(flowId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid flow ID' },
        { status: 400 }
      );
    }

    await deleteApprovalFlow(flowId);

    return NextResponse.json({
      success: true,
      message: 'Approval flow deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting approval flow:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete approval flow' },
      { status: 500 }
    );
  }
}
