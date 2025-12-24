/**
 * Label Verification - Operator Verify API
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T079)
 *
 * POST: Operator verifies label content with electronic signature
 * FR-064: Label verification with e-signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  verifyLabel,
  getLabelVerificationDetails,
  type VerifyLabelInput,
} from '@/lib/services/label-verification.service';

interface RouteContext {
  params: Promise<{ labelId: string }>;
}

/**
 * POST /api/production/labels/[labelId]/verify
 * Operator verifies label content with electronic signature
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

    const { labelId } = await context.params;
    const labelIdNum = parseInt(labelId, 10);

    if (isNaN(labelIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid label ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password, isCorrect, rejectionReason } = body;

    // Validate required fields
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required for electronic signature' },
        { status: 400 }
      );
    }

    if (typeof isCorrect !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isCorrect field is required (true/false)' },
        { status: 400 }
      );
    }

    // If rejecting, require reason
    if (!isCorrect && !rejectionReason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required when label is incorrect' },
        { status: 400 }
      );
    }

    // Get user ID from session
    const userId = session.userId;

    // Get IP and user agent for signature audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const input: VerifyLabelInput = {
      labelId: labelIdNum,
      userId,
      password,
      isCorrect,
      rejectionReason,
      ipAddress,
      userAgent,
    };

    const result = await verifyLabel(input);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Get full details
    const details = await getLabelVerificationDetails(labelIdNum);

    return NextResponse.json({
      success: true,
      data: details,
      message: isCorrect
        ? 'Label verified successfully. Awaiting witness signature.'
        : 'Label rejected. Please correct the label and try again.',
    });
  } catch (error) {
    console.error('Error verifying label:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify label' },
      { status: 500 }
    );
  }
}
