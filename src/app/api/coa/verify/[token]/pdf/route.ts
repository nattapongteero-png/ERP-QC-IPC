/**
 * Public COA PDF download — NO AUTH.
 *   GET /api/coa/verify/[token]/pdf
 *
 * Anyone holding the QR token printed on the COA can fetch the OFFICIAL PDF
 * (no DRAFT watermark) without logging in. This is the same artifact the QA
 * team would email to the customer — but customers and auditors can pull it
 * straight off the printed certificate.
 *
 * Security model:
 *   - The QR token is a random 32-byte URL-safe value (~43 chars). It is the
 *     ONLY shared secret. Anyone who has it gets the PDF.
 *   - To deter brute-force scanning, we rate-limit by source IP: 60 req/min.
 *     Going over that returns HTTP 429.
 *   - Only COAs with status='issued' are served. draft/review/approved/
 *     superseded/revoked all return 404 — we don't expose internal lifecycle
 *     state to consumers.
 *   - Every successful render is logged to coa_print_history with print_type
 *     = 'official' so QA can see how often the customer pulled the PDF.
 *
 * Failure modes:
 *   - Bad / unknown / non-issued token → 404 + opaque message
 *   - Rate limited                      → 429 with Retry-After
 *   - Chromium not available            → 503 with hint to use the viewer
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIssuedCoaForPublicPdf,
  logCoaPrint,
} from '@/lib/services/coa.service';
import {
  renderCoaPdf,
  CoaPdfRenderError,
} from '@/lib/coa/pdf-renderer';
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
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // 1. Rate limit per IP
    const ip = getClientIp(request);
    if (!PUBLIC_VERIFY_PDF_LIMITER.consume(ip)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Too many requests — please slow down and try again shortly.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        },
      );
    }

    // 2. Validate token + load issued-only COA
    const coa = await getIssuedCoaForPublicPdf(token);
    if (!coa) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Certificate not found or no longer valid.',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // 3. Render PDF (no watermark — this is the official version)
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    try {
      const pdfBuffer = await renderCoaPdf(coa, {
        watermark: null,
        baseUrl,
      });

      // 4. Audit print
      await logCoaPrint({
        coaId: coa.id,
        printedBy: coa.createdBy, // best-effort attribution: original creator
        printType: 'official',
        ipAddress: ip,
      });

      const filename = `${coa.coaNumber}.pdf`;
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
          // Public + cache-bust per token: COAs are immutable once issued.
          'Cache-Control': 'public, max-age=300, must-revalidate',
        },
      });
    } catch (err) {
      if (
        err instanceof CoaPdfRenderError &&
        err.code === 'CHROMIUM_UNAVAILABLE'
      ) {
        return new NextResponse(
          JSON.stringify({
            success: false,
            error:
              'PDF generation is temporarily unavailable on this server. Please use the online viewer to inspect the certificate.',
            code: 'CHROMIUM_UNAVAILABLE',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      console.error('[coa-verify-pdf] render error:', err);
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Failed to generate certificate PDF.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('[coa-verify-pdf] unexpected error:', error);
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch certificate.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
