/**
 * API Route: Approval Flows (T013)
 * GET /api/settings/approval-flows - List all approval flows
 * POST /api/settings/approval-flows - Create new approval flow
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createApprovalFlow,
  listApprovalFlows,
} from '@/lib/services/approval-workflow.service';
import {
  approvalFlowCreateSchema,
  approvalFlowQuerySchema,
} from '@/lib/validation/approval-workflow';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = approvalFlowQuerySchema.parse({
      documentType: searchParams.get('documentType'),
      isActive: searchParams.get('isActive'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const result = await listApprovalFlows(query);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    console.error('Error listing approval flows:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list approval flows' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = approvalFlowCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const createdBy = body.createdBy ?? 1;

    const id = await createApprovalFlow(data, createdBy);

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Approval flow created successfully',
    });
  } catch (error) {
    console.error('Error creating approval flow:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create approval flow' },
      { status: 500 }
    );
  }
}
