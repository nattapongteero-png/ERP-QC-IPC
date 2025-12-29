/**
 * Purchase Requisitions API Route (T037)
 * GET /api/purchasing/requisitions - List PRs
 * POST /api/purchasing/requisitions - Create PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPR, listPRs } from '@/lib/services/purchase-requisition.service';
import { prCreateSchema, prListFilterSchema } from '@/lib/validation/purchase-requisition';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterInput = {
      status: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      requesterId: searchParams.get('requesterId') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    };

    const filter = prListFilterSchema.parse(filterInput);
    const result = await listPRs(filter);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error listing PRs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list PRs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = prCreateSchema.parse(body);
    const userId = session.userId;

    const prId = await createPR(data, userId);

    return NextResponse.json({ success: true, id: prId }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating PR:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create PR' },
      { status: 500 }
    );
  }
}
