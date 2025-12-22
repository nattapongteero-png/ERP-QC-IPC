/**
 * Document File View API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/view/[...path] - View a document file inline (for preview)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import {
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// GET /api/documents/view/[...path] - View file inline
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { path: pathSegments } = await params;

        if (!pathSegments || pathSegments.length === 0) {
          return errorResponse('File path is required', 400);
        }

        // Reconstruct file path
        const relativePath = pathSegments.join('/');

        // Security: prevent directory traversal
        if (relativePath.includes('..') || relativePath.includes('//')) {
          return errorResponse('Invalid file path', 400);
        }

        // Only allow files from uploads/documents directory
        if (!relativePath.startsWith('uploads/documents/')) {
          return errorResponse('Access denied', 403);
        }

        const filePath = join(process.cwd(), 'data', relativePath);

        // Check if file exists
        try {
          const fileStat = await stat(filePath);
          if (!fileStat.isFile()) {
            return errorResponse('File not found', 404);
          }
        } catch {
          return errorResponse('File not found', 404);
        }

        // Get file extension and MIME type
        const extension = '.' + relativePath.split('.').pop()?.toLowerCase();
        const mimeType = MIME_TYPES[extension] || 'application/octet-stream';

        // Read file
        const fileBuffer = await readFile(filePath);

        // Extract original filename from path
        const filename = relativePath.split('/').pop() || 'document';

        // Return file with inline headers for preview
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': String(fileBuffer.length),
            'Cache-Control': 'private, max-age=3600',
            // Allow iframe embedding
            'X-Frame-Options': 'SAMEORIGIN',
          },
        });
      } catch (error) {
        console.error('[Documents] File view error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
