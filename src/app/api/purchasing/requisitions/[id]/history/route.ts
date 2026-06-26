/**
 * Purchase Requisition Approval History API Route
 * GET /api/purchasing/requisitions/[id]/history - Action timeline (who created,
 * submitted, approved/rejected the PR, with dates and comments).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPRApprovalHistory } from '@/lib/services/purchase-requisition.service';
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

    const timeline = await getPRApprovalHistory(prId);

    return NextResponse.json({ success: true, data: timeline });
  } catch (error: any) {
    console.error('Error getting PR history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get PR history' },
      { status: 500 }
    );
  }
}
