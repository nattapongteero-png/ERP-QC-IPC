/**
 * QC Disposition API
 * Feature: 009-gmp-compliance-gap-analysis Phase 7 (US15 - T087)
 *
 * POST: Set disposition decision on a QC test
 * GET: Get disposition details for a test
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import {
  setDisposition,
  getDispositionDetails,
  type DispositionType,
} from '@/lib/services/qc-disposition.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/quality/tests/[id]/disposition
 * Get disposition details for a test
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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

    const details = await getDispositionDetails(testIdNum);

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'Test not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error fetching disposition details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch disposition details' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quality/tests/[id]/disposition
 * Set disposition decision with electronic signature
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
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
    const { disposition, reason, password } = body;

    // Validate required fields
    if (!disposition) {
      return NextResponse.json(
        { success: false, error: 'Disposition is required' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required for electronic signature' },
        { status: 400 }
      );
    }

    // Validate disposition type
    const validDispositions: DispositionType[] = [
      'accept',
      'reject',
      'rework',
      'scrap',
      'return_to_vendor',
      'conditional_release',
    ];

    if (!validDispositions.includes(disposition)) {
      return NextResponse.json(
        { success: false, error: 'Invalid disposition type' },
        { status: 400 }
      );
    }

    const userId = session.user.id as number;

    const result = await setDisposition({
      testId: testIdNum,
      disposition,
      reason: reason || '',
      userId,
      password,
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
      },
    });
  } catch (error) {
    console.error('Error setting disposition:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set disposition' },
      { status: 500 }
    );
  }
}
