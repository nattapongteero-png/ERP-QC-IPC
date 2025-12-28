/**
 * API Route: Approval Delegations (T023)
 * GET /api/approval/delegations - List delegations
 * POST /api/approval/delegations - Create new delegation
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createApprovalDelegation,
  listApprovalDelegations,
} from '@/lib/services/approval-workflow.service';
import {
  approvalDelegationCreateSchema,
  approvalDelegationQuerySchema,
} from '@/lib/validation/approval-workflow';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = approvalDelegationQuerySchema.parse({
      delegatorId: searchParams.get('delegatorId'),
      delegateId: searchParams.get('delegateId'),
      isActive: searchParams.get('isActive'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const result = await listApprovalDelegations(query);

    return NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    console.error('Error listing delegations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list delegations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = approvalDelegationCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const createdBy = body.createdBy ?? 1;

    const id = await createApprovalDelegation({
      ...data,
      createdBy,
    });

    return NextResponse.json({
      success: true,
      data: { id },
      message: 'Delegation created successfully',
    });
  } catch (error) {
    console.error('Error creating delegation:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create delegation' },
      { status: 500 }
    );
  }
}
