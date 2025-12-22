/**
 * Close Recall API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/:id/close - Close recall
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { closeRecall } from '@/lib/services/recall-service';
import { recallCloseSchema } from '@/lib/validation/recalls';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.user.role, 'recalls:close')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = recallCloseSchema.parse(body);

    const recall = await closeRecall(recallId, validatedData, session.user.id);

    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: recall });
  } catch (error) {
    console.error('Error closing recall:', error);
    const message = error instanceof Error ? error.message : 'Failed to close recall';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
