/**
 * PR Reject API Route (T041)
 * POST /api/purchasing/requisitions/[id]/reject - Reject PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectPR } from '@/lib/services/purchase-requisition.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
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
    const reason = body.reason || body.comments || '';

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const userId = session.user.id ? parseInt(String(session.user.id), 10) : 1;

    await rejectPR(prId, userId, reason);

    return NextResponse.json({ success: true, message: 'PR rejected successfully' });
  } catch (error: any) {
    console.error('Error rejecting PR:', error);

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'PR not found',
      PR_NOT_PENDING_APPROVAL: 'PR is not pending approval',
      NO_APPROVAL_REQUEST: 'No approval request found',
      NOT_AUTHORIZED: 'You are not authorized to reject this PR',
    };

    const message = errorMessages[error.message] || error.message || 'Failed to reject PR';
    const status = error.message === 'PR_NOT_FOUND' ? 404 :
                   error.message === 'NOT_AUTHORIZED' ? 403 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
