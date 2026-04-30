/**
 * COA PDF — render & stream
 *   GET /api/quality/coa/[id]/pdf?type={preview|official}
 *
 * preview  → always renders (DRAFT watermark when status != 'issued')
 * official → 403 unless status='issued'
 *
 * Logs every render to coa_print_history (audit trail).
 *
 * If Chromium is unavailable in the runtime, returns 503 with a clear message
 * so callers can fall back to in-browser preview (CoaPreview.tsx).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getCoaById, logCoaPrint } from '@/lib/services/coa.service';
import {
  renderCoaPdf,
  renderCoaHtml,
  CoaPdfRenderError,
} from '@/lib/coa/pdf-renderer';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const coaId = Number(id);
      if (!Number.isFinite(coaId)) {
        return errorResponse('Invalid COA ID');
      }

      const { searchParams } = new URL(request.url);
      const type = (searchParams.get('type') || 'preview') as
        | 'preview'
        | 'official'
        | 'html';

      const coa = await getCoaById(coaId);
      if (!coa) return notFoundResponse('COA not found');

      // Gating
      if (type === 'official' && coa.status !== 'issued') {
        return forbiddenResponse(
          `Official PDF requires status='issued' — current status is '${coa.status}'`,
        );
      }

      // Compute base URL for QR
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      // Choose watermark
      const watermark =
        type === 'official'
          ? null
          : coa.status === 'issued'
            ? 'PREVIEW'
            : 'DRAFT';

      // For diagnostic / preview-fallback, allow ?type=html to skip Puppeteer
      if (type === 'html') {
        const html = await renderCoaHtml(coa, { watermark, baseUrl });
        const ipHeader =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          '';
        const ip = ipHeader.split(',')[0]?.trim() || undefined;
        await logCoaPrint({
          coaId,
          printedBy: session.userId,
          printType: 'preview',
          ipAddress: ip,
        });
        return new NextResponse(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'private, no-cache, must-revalidate',
          },
        });
      }

      // PDF render
      try {
        const pdfBuffer = await renderCoaPdf(coa, { watermark, baseUrl });

        const ipHeader =
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          '';
        const ip = ipHeader.split(',')[0]?.trim() || undefined;
        await logCoaPrint({
          coaId,
          printedBy: session.userId,
          printType: type === 'official' ? 'official' : 'preview',
          ipAddress: ip,
        });

        const filename = `${coa.coaNumber}${type === 'official' ? '' : '-preview'}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': String(pdfBuffer.length),
            'Cache-Control': 'private, no-cache, must-revalidate',
          },
        });
      } catch (err) {
        if (err instanceof CoaPdfRenderError && err.code === 'CHROMIUM_UNAVAILABLE') {
          // Graceful degradation: tell caller to fall back to HTML preview
          return new NextResponse(
            JSON.stringify({
              success: false,
              error:
                'PDF generation unavailable in this environment (Chromium not installed). Use ?type=html for an HTML preview instead.',
              code: 'CHROMIUM_UNAVAILABLE',
              hint: `Try /api/quality/coa/${coaId}/pdf?type=html`,
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        console.error('[coa-pdf] render error:', err);
        return serverErrorResponse(err);
      }
    } catch (error) {
      console.error('Error generating COA PDF:', error);
      return serverErrorResponse(error);
    }
  });
}
