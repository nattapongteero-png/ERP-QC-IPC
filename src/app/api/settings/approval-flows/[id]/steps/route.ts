/**
 * API Route: Approval Flow Steps (T016)
 * POST /api/settings/approval-flows/[id]/steps - Add/replace steps for a flow
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  replaceApprovalSteps,
  getApprovalFlowById,
} from '@/lib/services/approval-workflow.service';
import { approvalStepBulkCreateSchema } from '@/lib/validation/approval-workflow';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const flowId = parseInt(id, 10);

    if (isNaN(flowId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid flow ID' },
        { status: 400 }
      );
    }

    // Verify flow exists
    const flow = await getApprovalFlowById(flowId);
    if (!flow) {
      return NextResponse.json(
        { success: false, error: 'Approval flow not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = approvalStepBulkCreateSchema.parse({
      flowId,
      steps: body.steps,
    });

    await replaceApprovalSteps(flowId, data.steps);

    return NextResponse.json({
      success: true,
      message: 'Approval steps updated successfully',
    });
  } catch (error) {
    console.error('Error updating approval steps:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update approval steps' },
      { status: 500 }
    );
  }
}
