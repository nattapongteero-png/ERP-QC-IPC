/**
 * Document Version File API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/versions/[versionId]/file - Get file by version ID
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
        const database = await getDb();
        const versions = isSqlite() ? sqliteDocumentVersions : mysqlDocumentVersions;

        const [version] = await database
          .select({
            id: versions.id,
            filePath: versions.filePath,
          })
          .from(versions)
          .where(eq(versions.id, versionIdNum));

        if (!version) {
          return errorResponse('Version not found', 404);
        }

        if (!version.filePath) {
          return errorResponse('No file attached to this version', 404);
        }

        // Construct file path
        // filePath stored as: data/uploads/documents/{docId}/{filename}
        const relativePath = version.filePath.replace(/^data\//, '');
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

        // Return file with appropriate headers
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
      } catch (error) {
        console.error('[Documents] File retrieval error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}
