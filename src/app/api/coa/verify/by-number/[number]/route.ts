/**
 * Public COA number → token resolver — NO AUTH.
 *   GET /api/coa/verify/by-number/[number]
 *
 * The public landing page (/coa/verify) lets customers type the COA number
 * printed on their certificate. We resolve the number → QR token here and
 * return the token so the client can redirect to the canonical
 * /coa/verify/[token] URL.
 *
 * Security:
 *   - Only returns the token for COAs that are currently 'issued' (the same
 *     filter the rest of the public verify endpoints apply).
 *   - Logs every lookup attempt to coa_verify_log via getCoaByCoaNumber so we
 *     can spot scraping / enumeration patterns.
 *   - Rate-limited per IP (60/min) along with the PDF endpoint to make brute-
 *     force enumeration of COA numbers expensive.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCoaByCoaNumber,
} from '@/lib/services/coa.service';
import { isSqlite } from '@/lib/db';
import { executeDbOperation } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import {
  sqliteCoaDocuments,
  mysqlCoaDocuments,
} from '@/lib/db/schema';
import { PUBLIC_VERIFY_PDF_LIMITER } from '@/lib/utils/rate-limiter';

function getClientIp(request: NextRequest): string {
  const ipHeader =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '';
  const ip = ipHeader.split(',')[0]?.trim();
  return ip || 'anonymous';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  try {
    const { number } = await params;
    const decoded = decodeURIComponent(number);

    // Rate limit
    const ip = getClientIp(request);
    if (!PUBLIC_VERIFY_PDF_LIMITER.consume(ip)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many requests — please slow down.',
        },
        { status: 429 },
      );
    }

    // 1. Run public-safe view — this also logs the verify attempt
    const userAgent = request.headers.get('user-agent') ?? undefined;
    const referer = request.headers.get('referer') ?? undefined;
    const view = await getCoaByCoaNumber(decoded, {
      ipAddress: ip,
      userAgent,
      referer,
    });

    if (!view) {
      return NextResponse.json(
        {
          success: false,
          error: 'Certificate not found or no longer valid.',
        },
        { status: 404 },
      );
    }

    // 2. Resolve token so the caller can redirect to /coa/verify/[token].
    // We keep this server-side so the public-safe view in step 1 doesn't have
    // to leak the token.
    const token = await executeDbOperation(async (db) => {
      const table = isSqlite() ? sqliteCoaDocuments : mysqlCoaDocuments;
      const [row] = await db
        .select({ qrCodeToken: table.qrCodeToken })
        .from(table)
        .where(eq(table.coaNumber, decoded))
        .limit(1);
      return row?.qrCodeToken ? String(row.qrCodeToken) : null;
    });

    if (!token) {
      // Shouldn't happen — view succeeded. Fail safe.
      return NextResponse.json(
        {
          success: false,
          error: 'Certificate not found.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        token,
        coaNumber: view.coaNumber,
        status: view.status,
      },
    });
  } catch (error) {
    console.error('[coa-verify-by-number] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Verification failed.',
      },
      { status: 500 },
    );
  }
}
