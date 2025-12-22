/**
 * Start Recall API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/recalls/:id/start - Start recall execution
 */

import { NextRequest, NextResponse } from 'next/server';


import { getSession, hasPermission } from '@/lib/auth';
import { startRecall } from '@/lib/services/recall-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:execute')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const recall = await startRecall(recallId, session.userId);

    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: recall });
  } catch (error) {
    console.error('Error starting recall:', error);
    const message = error instanceof Error ? error.message : 'Failed to start recall';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
