/**
 * Attachment Download API
 *
 * GET /api/attachments/[id]/download - Download attachment file
 * Query params:
 * - inline=1: Display inline (for preview) instead of forcing download
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAttachmentFileData } from '@/lib/services/attachment-service';
import { canPreviewInline } from '@/lib/validation/attachments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/attachments/[id]/download - Download file
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId) || attachmentId <= 0) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const { searchParams } = new URL(request.url);
        const isInline = searchParams.get('inline') === '1';

        // Get file data from database
        const fileData = await getAttachmentFileData(attachmentId);

        if (!fileData) {
          return errorResponse('Attachment not found', 404);
        }

        // Determine Content-Disposition
        const canInline = isInline && canPreviewInline(fileData.mimeType);
        const disposition = canInline
          ? 'inline'
          : `attachment; filename="${encodeURIComponent(fileData.fileName)}"`;

        console.log(
          `[Attachments] File downloaded: ID ${attachmentId}, ${fileData.fileName} (${fileData.fileSize} bytes)`
        );

        // Return file with appropriate headers
        // Convert Buffer to Uint8Array for NextResponse compatibility
        const fileBuffer = new Uint8Array(fileData.data);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': fileData.mimeType,
            'Content-Disposition': disposition,
            'Content-Length': String(fileData.fileSize),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (error) {
        console.error('[Attachments] Download error:', error);
        return serverErrorResponse(error);
      }
    },
    []
  );
}
