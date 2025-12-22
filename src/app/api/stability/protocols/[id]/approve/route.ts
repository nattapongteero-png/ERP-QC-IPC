/**
 * Stability Protocol Approve API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 7.4)
 *
 * POST /api/stability/protocols/[id]/approve - Approve protocol
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveProtocol } from '@/lib/services/stability-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const protocolId = parseInt(id, 10);
    if (isNaN(protocolId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid protocol ID' },
        { status: 400 }
      );
    }

    const protocol = await approveProtocol(protocolId, session.userId);
    if (!protocol) {
      return NextResponse.json(
        { success: false, error: 'Protocol not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: protocol,
    });
  } catch (error) {
    console.error('Error approving protocol:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve protocol',
      },
      { status: 500 }
    );
  }
}
