/**
 * Document File Upload API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * POST /api/documents/upload - Upload a file for document version
 *
 * Files are stored as BLOB data in the database, not on the filesystem.
 * This API validates the file and returns base64-encoded data for storage.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

// Allowed file types for GMP documents
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// POST /api/documents/upload - Upload file
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const documentId = formData.get('documentId') as string | null;

        if (!file) {
          return errorResponse('No file provided', 400);
        }

        if (!documentId) {
          return errorResponse('Document ID is required', 400);
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          return errorResponse('File size must be less than 10MB', 400);
        }

        // Validate file type
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
          return errorResponse(
            `Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
            400
          );
        }

        // Check MIME type if available
        if (file.type && !ALLOWED_TYPES.includes(file.type)) {
          console.warn(`Unexpected MIME type: ${file.type} for file ${file.name}`);
          // Don't reject - some browsers report different MIME types
        }

        // Convert file to buffer and base64 for database storage
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Data = buffer.toString('base64');

        console.log(`[Documents] File prepared for DB storage: ${file.name} (${file.size} bytes) by user ${session.userId}`);

        return successResponse(
          {
            fileData: base64Data,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
          },
          'File processed successfully'
        );
      } catch (error) {
        console.error('[Documents] File upload error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
