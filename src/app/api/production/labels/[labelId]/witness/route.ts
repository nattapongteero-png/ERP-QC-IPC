/**
 * Label Verification - Witness API
 * Feature: 009-gmp-compliance-gap-analysis Phase 6 (US14 - T080)
 *
 * POST: Witness confirms label verification with electronic signature
 * FR-065: Dual verification with witness signature (different person from operator)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import {
  witnessLabel,
  getLabelVerificationDetails,
  type WitnessLabelInput,
} from '@/lib/services/label-verification.service';

interface RouteContext {
  params: Promise<{ labelId: string }>;
}

/**
 * POST /api/production/labels/[labelId]/witness
 * Witness confirms label verification with electronic signature
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

    const { labelId } = await context.params;
    const labelIdNum = parseInt(labelId, 10);

    if (isNaN(labelIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid label ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { password } = body;

    // Validate required fields
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required for electronic signature' },
        { status: 400 }
      );
    }

    // Get user ID from session
    const userId = session.user.id as number;

    // Get IP and user agent for signature audit trail
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const input: WitnessLabelInput = {
      labelId: labelIdNum,
      userId,
      password,
      ipAddress,
      userAgent,
    };

    const result = await witnessLabel(input);

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
      message: 'Label verification witnessed successfully. Dual sign-off complete.',
    });
  } catch (error) {
    console.error('Error witnessing label:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to witness label verification' },
      { status: 500 }
    );
  }
}
