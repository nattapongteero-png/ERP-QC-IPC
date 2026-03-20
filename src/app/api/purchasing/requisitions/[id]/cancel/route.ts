/**
 * PR Cancel API Route
 * POST /api/purchasing/requisitions/[id]/cancel - Cancel PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { cancelPR } from '@/lib/services/purchase-requisition.service';
import { getSession } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'Cancelled by user';

    await cancelPR(prId, reason);

    return NextResponse.json({ success: true, message: 'PR cancelled successfully' });
  } catch (error: any) {
    console.error('Error cancelling PR:', error);

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'PR not found',
      PR_CANNOT_BE_CANCELLED: 'PR cannot be cancelled (already converted or cancelled)',
    };

    const message = errorMessages[error.message] || error.message || 'Failed to cancel PR';
    const status = error.message === 'PR_NOT_FOUND' ? 404 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
