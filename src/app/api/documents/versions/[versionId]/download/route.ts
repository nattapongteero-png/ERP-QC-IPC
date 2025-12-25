/**
 * Document Version File Download API (BLOB Storage)
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/versions/[versionId]/download - Download file from database BLOB
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getVersionFileData } from '@/lib/services/document-service';

interface RouteParams {
  params: Promise<{ versionId: string }>;
}

// GET /api/documents/versions/[versionId]/download - Download file from DB
// Query params:
// - inline=1: Display inline (for preview) instead of forcing download
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { versionId: versionIdStr } = await params;
        const versionId = parseInt(versionIdStr, 10);

        if (isNaN(versionId) || versionId <= 0) {
          return errorResponse('Invalid version ID', 400);
        }

        const { searchParams } = new URL(request.url);
        const isInline = searchParams.get('inline') === '1';

        // Get file data from database
        const fileData = await getVersionFileData(versionId);

        if (!fileData) {
          return errorResponse('File not found', 404);
        }

        // Convert to buffer if needed
        const buffer = fileData.data instanceof Buffer
          ? fileData.data
          : Buffer.from(fileData.data);

        // Determine Content-Disposition based on inline flag and file type
        const extension = '.' + fileData.fileName.split('.').pop()?.toLowerCase();
        const safeInlineTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const canInline = isInline && safeInlineTypes.includes(extension);
        const disposition = canInline
          ? 'inline'
          : `attachment; filename="${encodeURIComponent(fileData.fileName)}"`;

        console.log(`[Documents] File downloaded from DB: version ${versionId}, ${fileData.fileName} (${fileData.fileSize} bytes)`);

        // Return file with appropriate headers
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': fileData.mimeType,
            'Content-Disposition': disposition,
            'Content-Length': String(fileData.fileSize),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (error) {
        console.error('[Documents] File download error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
