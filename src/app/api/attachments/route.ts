/**
 * Attachments API
 * Reusable file attachment endpoints for any module
 *
 * GET /api/attachments?moduleName=xxx&entityId=xxx - List attachments
 * POST /api/attachments - Upload new attachment
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAttachments,
  createAttachment,
} from '@/lib/services/attachment-service';
import {
  attachmentCreateSchema,
  attachmentListQuerySchema,
  isValidFileExtension,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/validation/attachments';

// GET /api/attachments - List attachments for a module entity
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const query = {
          moduleName: searchParams.get('moduleName'),
          entityId: searchParams.get('entityId'),
          category: searchParams.get('category') || undefined,
        };

        // Validate query params
        const parseResult = attachmentListQuerySchema.safeParse(query);
        if (!parseResult.success) {
          return errorResponse('Invalid query parameters', 400, {
            errors: parseResult.error.issues,
          });
        }

        const { moduleName, entityId } = parseResult.data;
        const attachments = await getAttachments(moduleName, entityId);

        // Filter by category if provided
        const filtered = parseResult.data.category
          ? attachments.filter((a) => a.category === parseResult.data.category)
          : attachments;

        return successResponse(filtered);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    [] // No specific permission - each module handles its own permissions
  );
}

// POST /api/attachments - Create new attachment
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = attachmentCreateSchema.safeParse(body);
        if (!parseResult.success) {
          return errorResponse('Validation failed', 400, {
            errors: parseResult.error.issues,
          });
        }

        const data = parseResult.data;

        // Validate file extension
        if (!isValidFileExtension(data.fileName)) {
          return errorResponse(
            'Invalid file type. Supported: PDF, Word, Excel, Images, Text/CSV',
            400
          );
        }

        // Validate MIME type (allow unknown for browser inconsistencies)
        if (data.mimeType && !ALLOWED_MIME_TYPES.includes(data.mimeType)) {
          console.warn(`[Attachments] Unexpected MIME type: ${data.mimeType}`);
        }

        // Validate file size
        if (data.fileSize > MAX_FILE_SIZE) {
          return errorResponse('File size must be less than 10MB', 400);
        }

        // Decode base64 to buffer
        const fileBuffer = Buffer.from(data.fileData, 'base64');

        const attachment = await createAttachment(
          {
            moduleName: data.moduleName,
            entityId: data.entityId,
            fileName: data.fileName,
            fileSize: data.fileSize,
            mimeType: data.mimeType,
            fileData: fileBuffer,
            description: data.description,
            category: data.category,
          },
          session.userId
        );

        console.log(
          `[Attachments] File uploaded: ${data.fileName} for ${data.moduleName}/${data.entityId} by user ${session.userId}`
        );

        return successResponse(attachment, 'File uploaded successfully');
      } catch (error) {
        console.error('[Attachments] Upload error:', error);
        return serverErrorResponse(error);
      }
    },
    [] // No specific permission - each module handles its own permissions
  );
}
