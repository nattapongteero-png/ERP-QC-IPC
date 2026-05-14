// Employee photo file serving endpoint.
//
// Next.js standalone only serves files that existed in /public at BUILD time,
// so photos uploaded at runtime (POST /api/hr/employees/[id]/photo) return 404
// when requested as /uploads/employees/{id}/{file}. This route reads the file
// from disk on every request and streams it back with the right content type,
// which works transparently with the host bind mount configured per tenant.

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { getSession } from '@/lib/auth';

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'employees');

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

interface RouteParams {
  params: Promise<{ id: string; filename: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  // Require an authenticated session — photos can be personal info, and the
  // HR module guards every other endpoint. We don't enforce hr:read here so
  // any logged-in user can see a colleague's avatar in lists/headers.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { id, filename } = await params;
  const employeeId = Number(id);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ success: false, error: 'Invalid employee id' }, { status: 400 });
  }

  // Block traversal attempts early — legitimate filenames are produced by the
  // upload handler and look like photo-1698765432100.webp / thumb-*.webp.
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return NextResponse.json({ success: false, error: 'Invalid filename' }, { status: 400 });
  }

  const absolutePath = path.join(UPLOADS_ROOT, String(employeeId), filename);

  // Double-check the resolved path is still inside the uploads root.
  if (!absolutePath.startsWith(UPLOADS_ROOT + path.sep)) {
    return NextResponse.json({ success: false, error: 'Invalid path' }, { status: 400 });
  }

  try {
    await stat(absolutePath);
  } catch {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const buffer = await readFile(absolutePath);
  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      // Photos are stable (filename includes a timestamp), so let browsers
      // cache aggressively. A new upload produces a new filename anyway.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
