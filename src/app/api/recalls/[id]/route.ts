/**
 * Recall Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id - Get recall details
 * PATCH /api/recalls/:id - Update recall
 */

import { NextRequest, NextResponse } from 'next/server';


import { getSession, hasPermission } from '@/lib/auth';
import { getRecallDetails, updateRecall } from '@/lib/services/recall-service';
import { recallUpdateSchema } from '@/lib/validation/recalls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const recall = await getRecallDetails(recallId);

    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: recall });
  } catch (error) {
    console.error('Error getting recall:', error);
    const message = error instanceof Error ? error.message : 'Failed to get recall';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = recallUpdateSchema.parse(body);

    const recall = await updateRecall(recallId, validatedData, session.id);

    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: recall });
  } catch (error) {
    console.error('Error updating recall:', error);
    const message = error instanceof Error ? error.message : 'Failed to update recall';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
