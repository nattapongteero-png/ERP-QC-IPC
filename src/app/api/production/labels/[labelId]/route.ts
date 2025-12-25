/**
 * Label Verification Detail API
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14)
 *
 * GET: Get label verification details by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getLabelVerificationDetails } from '@/lib/services/label-verification.service';

interface RouteContext {
  params: Promise<{ labelId: string }>;
}

/**
 * GET /api/production/labels/[labelId]
 * Get label verification details
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { labelId } = await context.params;
    const labelIdNum = parseInt(labelId, 10);

    if (isNaN(labelIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid label ID' },
        { status: 400 }
      );
    }

    const details = await getLabelVerificationDetails(labelIdNum);

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'Label verification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: details,
    });
  } catch (error) {
    console.error('Error fetching label verification:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch label verification' },
      { status: 500 }
    );
  }
}
