/**
 * CoA Logo Upload API
 *
 * POST /api/uploads/coa-logo
 * Body: multipart/form-data with `file` (image)
 *
 * Stores uploaded images under /public/uploads/coa-logos/ and returns the
 * public URL path that can be embedded in coa_templates.headerLogoPath. Unlike
 * the document-upload endpoint, logos are served as static files so the
 * Puppeteer renderer + COA preview can fetch them directly via <img src>.
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — logos are small.

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return errorResponse('No file provided', 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return errorResponse('File size must be less than 5MB', 400);
      }

      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return errorResponse(
          `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
          400,
        );
      }
      if (file.type && !ALLOWED_MIME.includes(file.type)) {
        // Some browsers report unexpected MIME types — log and continue.
        console.warn(`[CoA logo] Unexpected MIME type: ${file.type} for ${file.name}`);
      }

      // Persist under /public/uploads/coa-logos so Next.js serves the file
      // statically. Filename uses timestamp + a short suffix to avoid clashes
      // when the same logo file is uploaded multiple times.
      const baseDir = join(process.cwd(), 'public', 'uploads', 'coa-logos');
      await mkdir(baseDir, { recursive: true });
      const safeBase = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80) || 'logo';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}${ext}`;
      const fullPath = join(baseDir, fileName);

      const bytes = await file.arrayBuffer();
      await writeFile(fullPath, Buffer.from(bytes));

      // Serve through /api/uploads/coa-logo/{filename} — the static path
      // /uploads/coa-logos/* would 404 because Next.js standalone only serves
      // files present in /public at BUILD time. The matching GET route at
      // [filename]/route.ts streams the file from disk on each request.
      const publicPath = `/api/uploads/coa-logo/${fileName}`;
      console.log(
        `[CoA logo] Saved ${publicPath} (${file.size} bytes) by user ${session.userId}`,
      );

      return successResponse(
        {
          path: publicPath,
          fileName,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
        },
        'Logo uploaded',
      );
    } catch (error) {
      console.error('[CoA logo] Upload error:', error);
      return serverErrorResponse(error);
    }
  });
}
