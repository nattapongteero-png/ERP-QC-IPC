/**
 * PR Approve API Route (T040)
 * POST /api/purchasing/requisitions/[id]/approve - Approve PR
 */

import { NextRequest, NextResponse } from 'next/server';
import { approvePR } from '@/lib/services/purchase-requisition.service';
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

    const body = await request.json().catch(() => ({}));
    const comments = body.comments || '';
    const userId = session.user.id ? parseInt(String(session.user.id), 10) : 1;

    await approvePR(prId, userId, comments);

    return NextResponse.json({ success: true, message: 'PR approved successfully' });
  } catch (error: any) {
    console.error('Error approving PR:', error);

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'PR not found',
      PR_NOT_PENDING_APPROVAL: 'PR is not pending approval',
      NO_APPROVAL_REQUEST: 'No approval request found',
      NOT_AUTHORIZED: 'You are not authorized to approve this PR',
    };

    const message = errorMessages[error.message] || error.message || 'Failed to approve PR';
    const status = error.message === 'PR_NOT_FOUND' ? 404 :
                   error.message === 'NOT_AUTHORIZED' ? 403 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
