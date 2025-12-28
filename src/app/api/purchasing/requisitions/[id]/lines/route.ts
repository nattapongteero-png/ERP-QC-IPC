/**
 * PR Lines API Route (T043)
 * GET /api/purchasing/requisitions/[id]/lines - Get PR lines
 * POST /api/purchasing/requisitions/[id]/lines - Add lines to PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPRById, addPRLines, updatePRLine, deletePRLine } from '@/lib/services/purchase-requisition.service';
import { prLineCreateSchema, prLinesCreateSchema } from '@/lib/validation/purchase-requisition';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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

    return NextResponse.json({ success: true, data: pr.lines });
  } catch (error: any) {
    console.error('Error getting PR lines:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get PR lines' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const body = await request.json();

    // Support both single line and batch lines
    let lines: any[];
    if (Array.isArray(body.lines)) {
      const data = prLinesCreateSchema.parse(body);
      lines = data.lines;
    } else {
      const data = prLineCreateSchema.parse(body);
      lines = [data];
    }

    const lineIds = await addPRLines(prId, lines);

    return NextResponse.json({ success: true, ids: lineIds }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding PR lines:', error);

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
      { success: false, error: error.message || 'Failed to add PR lines' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const body = await request.json();
    const lineId = body.lineId;

    if (!lineId) {
      return NextResponse.json({ success: false, error: 'Line ID is required' }, { status: 400 });
    }

    await updatePRLine(prId, lineId, body);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating PR line:', error);

    if (error.message === 'PR_NOT_FOUND' || error.message === 'LINE_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PR or line not found' }, { status: 404 });
    }
    if (error.message === 'PR_NOT_EDITABLE') {
      return NextResponse.json(
        { success: false, error: 'PR is not in draft status' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update PR line' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const prId = parseInt(id, 10);

    if (isNaN(prId)) {
      return NextResponse.json({ success: false, error: 'Invalid PR ID' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const lineId = parseInt(searchParams.get('lineId') || '', 10);

    if (isNaN(lineId)) {
      return NextResponse.json({ success: false, error: 'Line ID is required' }, { status: 400 });
    }

    await deletePRLine(prId, lineId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting PR line:', error);

    if (error.message === 'PR_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'PR not found' }, { status: 404 });
    }
    if (error.message === 'PR_NOT_EDITABLE') {
      return NextResponse.json(
        { success: false, error: 'PR is not in draft status' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete PR line' },
      { status: 500 }
    );
  }
}
