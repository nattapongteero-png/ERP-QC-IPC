/**
 * Individual Attachment API
 *
 * GET /api/attachments/[id] - Get attachment details
 * PUT /api/attachments/[id] - Update attachment metadata
 * DELETE /api/attachments/[id] - Delete attachment
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getAttachmentById,
  updateAttachment,
  deleteAttachment,
} from '@/lib/services/attachment-service';
import { attachmentUpdateSchema } from '@/lib/validation/attachments';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/attachments/[id] - Get attachment details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const attachment = await getAttachmentById(attachmentId);

        if (!attachment) {
          return notFoundResponse('Attachment not found');
        }

        return successResponse(attachment);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// PUT /api/attachments/[id] - Update attachment metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = attachmentUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          return errorResponse('Validation failed', 400, {
            errors: parseResult.error.issues,
          });
        }

        const attachment = await updateAttachment(
          attachmentId,
          parseResult.data,
          session.userId
        );

        return successResponse(attachment, 'Attachment updated successfully');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse(error.message);
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}

// DELETE /api/attachments/[id] - Delete attachment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
          return errorResponse('Invalid attachment ID', 400);
        }

        await deleteAttachment(attachmentId, session.userId);

        console.log(`[Attachments] File deleted: ID ${attachmentId} by user ${session.userId}`);

        return successResponse(null, 'Attachment deleted successfully');
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return notFoundResponse(error.message);
        }
        return serverErrorResponse(error);
      }
    },
    []
  );
}
