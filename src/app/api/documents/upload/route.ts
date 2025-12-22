/**
 * Document File Upload API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * POST /api/documents/upload - Upload a file for document version
 */

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
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

        // Create uploads directory if it doesn't exist
        const uploadsDir = join(process.cwd(), 'data', 'uploads', 'documents', documentId);
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_')
          .replace(/__+/g, '_');
        const filename = `${timestamp}_${sanitizedName}`;
        const filePath = join(uploadsDir, filename);

        // Convert file to buffer and write
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Return relative path for storage in database
        const relativePath = `data/uploads/documents/${documentId}/${filename}`;

        console.log(`[Documents] File uploaded: ${relativePath} by user ${session.userId}`);

        return successResponse(
          {
            filePath: relativePath,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
          'File uploaded successfully'
        );
      } catch (error) {
        console.error('[Documents] File upload error:', error);
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
