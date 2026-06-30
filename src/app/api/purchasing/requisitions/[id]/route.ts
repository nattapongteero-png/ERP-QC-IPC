/**
 * Purchase Requisition Detail API Route (T038)
 * GET /api/purchasing/requisitions/[id] - Get PR by ID
 * PUT /api/purchasing/requisitions/[id] - Update PR
 * DELETE /api/purchasing/requisitions/[id] - Delete PR (draft only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPRById, updatePR, deletePR } from '@/lib/services/purchase-requisition.service';
import { prUpdateSchema } from '@/lib/validation/purchase-requisition';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const pr = await getPRById(prId);

    if (!pr) {
      return NextResponse.json({ success: false, error: 'PR not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: pr });
  } catch (error: any) {
    console.error('Error getting PR:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get PR' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = prUpdateSchema.parse(body);

    // Transform null values to undefined for service compatibility
    const data = {
      ...parsed,
      requiredDate: parsed.requiredDate ?? undefined,
      description: parsed.description ?? undefined,
      justification: parsed.justification ?? undefined,
      costCenterId: parsed.costCenterId ?? undefined,
      projectId: parsed.projectId ?? undefined,
      vendorId: parsed.vendorId ?? undefined,
      paymentTerms: parsed.paymentTerms ?? undefined,
    };

    await updatePR(prId, data);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating PR:', error);
    if (error.message === 'PR_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PR not found' }, { status: 404 });
    }
    if (error.message === 'PR_NOT_EDITABLE') {
      return NextResponse.json(
        { success: false, error: 'PR is not in draft status and cannot be edited' },
        { status: 400 }
      );
    }
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update PR' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    await deletePR(prId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PR:', error);
    if (error.message === 'PR_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PR not found' }, { status: 404 });
    }
    if (error.message === 'PR_NOT_DELETABLE') {
      return NextResponse.json(
        { success: false, error: 'Only draft PRs can be deleted' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete PR' },
      { status: 500 }
    );
  }
}
