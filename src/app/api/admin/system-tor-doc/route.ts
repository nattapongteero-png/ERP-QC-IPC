import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * GET /api/admin/system-tor-doc
 *
 * Serves the comprehensive Markdown TOR (docs/SYSTEM-TOR.md) as a downloadable
 * file. This is the long-form, IT-PM/SA written TOR — paired with the Excel
 * version at /api/admin/system-tor.
 *
 * Query params:
 *   ?inline=1 → return as text/markdown for in-browser viewing
 *   (default) → force download as herbal-erp-tor-YYYYMMDD.md
 */
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const filePath = join(process.cwd(), 'docs', 'SYSTEM-TOR.md');
      const content = await readFile(filePath, 'utf-8');

      const url = new URL(request.url);
      const inline = url.searchParams.get('inline') === '1';

      const today = new Date();
      const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const filename = `herbal-erp-tor-${stamp}.md`;

      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': inline
            ? `inline; filename="${filename}"`
            : `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      return NextResponse.json(
        { success: false, error: `Failed to read TOR document: ${(err as Error).message}` },
        { status: 500 }
      );
    }
  });
}
