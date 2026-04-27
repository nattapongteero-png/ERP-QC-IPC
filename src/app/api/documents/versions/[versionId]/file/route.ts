/**
 * Document Version File API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/versions/[versionId]/file - Get file by version ID
 * Supports both filesystem (legacy) and BLOB (database) storage.
 * Use ?inline=true to view inline (for PDF preview)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import {
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDb, isSqlite } from '@/lib/db';
import { sqliteDocumentVersions, mysqlDocumentVersions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getVersionFileData, deleteVersionFile } from '@/lib/services/document-service';

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

interface RouteParams {
  params: Promise<{ versionId: string }>;
}

// GET /api/documents/versions/[versionId]/file
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { versionId } = await params;
        const { searchParams } = new URL(request.url);
        const isInline = searchParams.get('inline') === 'true';

        const versionIdNum = parseInt(versionId, 10);
        if (isNaN(versionIdNum) || versionIdNum <= 0) {
          return errorResponse('Invalid version ID', 400);
        }

        // Get version from database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const database = (await getDb()) as any;
        const versions = isSqlite() ? sqliteDocumentVersions : mysqlDocumentVersions;

        const [version] = await database
          .select({
            id: versions.id,
            filePath: versions.filePath,
            fileName: versions.fileName,
            mimeType: versions.mimeType,
            fileSize: versions.fileSize,
          })
          .from(versions)
          .where(eq(versions.id, versionIdNum));

        if (!version) {
          return errorResponse('Version not found', 404);
        }

        // Strategy 1: Try filesystem (legacy filePath)
        if (version.filePath) {
          try {
            const relativePath = version.filePath.replace(/^data\//, '');
            const filePath = join(process.cwd(), 'data', relativePath);
            const fileStat = await stat(filePath);

            if (fileStat.isFile()) {
              const fileBuffer = await readFile(filePath);
              const extension = '.' + relativePath.split('.').pop()?.toLowerCase();
              const mimeType = MIME_TYPES[extension] || 'application/octet-stream';
              const filename = relativePath.split('/').pop() || 'document';
              const disposition = isInline ? 'inline' : 'attachment';

              return new NextResponse(fileBuffer, {
                headers: {
                  'Content-Type': mimeType,
                  'Content-Disposition': `${disposition}; filename="${filename}"`,
                  'Content-Length': String(fileBuffer.length),
                  'Cache-Control': 'private, max-age=3600',
                  ...(isInline && { 'X-Frame-Options': 'SAMEORIGIN' }),
                },
              });
            }
          } catch {
            // File not found on filesystem, fall through to BLOB
          }
        }

        // Strategy 2: Try BLOB storage (database fileData)
        const fileData = await getVersionFileData(versionIdNum);
        if (fileData) {
          const buffer = fileData.data instanceof Buffer
            ? fileData.data
            : Buffer.from(fileData.data);

          const extension = '.' + fileData.fileName.split('.').pop()?.toLowerCase();
          const safeInlineTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
          const canInline = isInline && safeInlineTypes.includes(extension);
          const disposition = canInline
            ? 'inline'
            : `attachment; filename="${encodeURIComponent(fileData.fileName)}"`;

          return new NextResponse(buffer, {
            headers: {
              'Content-Type': fileData.mimeType,
              'Content-Disposition': disposition,
              'Content-Length': String(fileData.fileSize),
              'Cache-Control': 'private, max-age=3600',
              ...(canInline && { 'X-Frame-Options': 'SAMEORIGIN' }),
            },
          });
        }

        return errorResponse('No file attached to this version', 404);
      } catch (error) {
        console.error('[Documents] File retrieval error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}

// DELETE /api/documents/versions/[versionId]/file - Delete file from version
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { versionId } = await params;
        const versionIdNum = parseInt(versionId, 10);

        if (isNaN(versionIdNum) || versionIdNum <= 0) {
          return errorResponse('Invalid version ID', 400);
        }

        await deleteVersionFile(versionIdNum, session.userId);

        return new NextResponse(
          JSON.stringify({ success: true, message: 'File deleted successfully' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
