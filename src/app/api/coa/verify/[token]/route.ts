/**
 * Public COA verification endpoint — NO AUTH.
 *   GET /api/coa/verify/[token]
 *
 * Anyone with the QR token from the printed PDF can call this to confirm:
 *   - the COA exists
 *   - it is currently 'issued' (or 'superseded' — surfaces the replacement number)
 *   - test results + signatures (name + role + timestamp only — no images)
 *
 * Returns 404 for draft/review/approved/revoked tokens to avoid leaking
 * pre-issuance data. Every hit is logged to coa_verify_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCoaByQrToken } from '@/lib/services/coa.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const ipHeader =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '';
    const ipAddress = ipHeader.split(',')[0]?.trim() || undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;

    const result = await getCoaByQrToken(token, {
      ipAddress,
      userAgent,
      referer,
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: 'Certificate not found or no longer valid',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error verifying COA token:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Verification failed',
      },
      { status: 500 },
    );
  }
}
