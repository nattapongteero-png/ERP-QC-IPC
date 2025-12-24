/**
 * QC Disposition Approval API
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T088)
 *
 * POST: Approve disposition decision with electronic signature (dual sign-off)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { approveDisposition } from '@/lib/services/qc-disposition.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/quality/tests/[id]/disposition/approve
 * Approve disposition decision with electronic signature
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const testIdNum = parseInt(id, 10);

    if (isNaN(testIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid test ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password, approvalNotes } = body;

    // Validate required fields
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required for electronic signature' },
        { status: 400 }
      );
    }

    const userId = session.userId;

    const result = await approveDisposition({
      testId: testIdNum,
      userId,
      password,
      approvalNotes,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        testId: result.testId,
        disposition: result.disposition,
        lotStatusUpdated: result.lotStatusUpdated,
        newLotStatus: result.newLotStatus,
      },
    });
  } catch (error) {
    console.error('Error approving disposition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve disposition' },
      { status: 500 }
    );
  }
}
