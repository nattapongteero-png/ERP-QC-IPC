/**
 * PR Submit API Route (T039)
 * POST /api/purchasing/requisitions/[id]/submit - Submit PR for approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitPRForApproval } from '@/lib/services/purchase-requisition.service';
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

    const userId = session.user.id ? parseInt(String(session.user.id), 10) : 1;
    const result = await submitPRForApproval(prId, userId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error submitting PR:', error);

    const errorMessages: Record<string, string> = {
      PR_NOT_FOUND: 'PR not found',
      PR_NOT_IN_DRAFT: 'PR is not in draft status',
      PR_NO_LINES: 'PR has no line items',
      NO_MATCHING_FLOW: 'No approval workflow found for this document type',
    };

    const message = errorMessages[error.message] || error.message || 'Failed to submit PR';
    const status = error.message === 'PR_NOT_FOUND' ? 404 : 400;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
