// CoA logo file serving endpoint.
//
// Next.js standalone only serves files that existed in /public at BUILD time,
// so logos uploaded at runtime (POST /api/uploads/coa-logo) return 404 when
// requested as /uploads/coa-logos/{file}. This route reads the file from disk
// on every request and streams it back with the right content type. Mirrors
// the same pattern used by /api/uploads/employees/[id]/[filename].

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '@/lib/auth';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'coa-logos');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

interface RouteParams {
  params: Promise<{ filename: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  // CoA logos are part of the printed certificate seen by customers; they
  // aren't strictly secret, but we still gate behind a logged-in session so
  // anonymous traffic can't enumerate them. Puppeteer fetches via the same
  // auth cookie when rendering official PDFs.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { filename } = await params;
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 });
  }

  const absolutePath = path.join(UPLOADS_ROOT, filename);
  // Defence-in-depth: ensure the resolved path is still inside the uploads root.
  if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 });
  }

  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    const data = await readFile(absolutePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] || 'application/octet-stream';
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    console.error('[CoA logo serve] read error:', err);
    return NextResponse.json({ success: false, error: 'Failed to read logo' }, { status: 500 });
  }
}
