/**
 * Recall Distribution API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id/distribution - Get distribution data for recall
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { getDistributionData, getRecallById } from '@/lib/services/recall-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.user.role, 'recalls:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const recallId = parseInt(id, 10);

    if (isNaN(recallId)) {
      return NextResponse.json({ success: false, error: 'Invalid recall ID' }, { status: 400 });
    }

    const recall = await getRecallById(recallId);
    if (!recall) {
      return NextResponse.json({ success: false, error: 'Recall not found' }, { status: 404 });
    }

    const distribution = await getDistributionData(recallId);

    return NextResponse.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Error getting distribution data:', error);
    const message = error instanceof Error ? error.message : 'Failed to get distribution data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
