/**
 * Document Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/[id] - Get document details with versions
 * PATCH /api/documents/[id] - Update document
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDocumentById, updateDocument } from '@/lib/services/document-service';
import { documentUpdateSchema } from '@/lib/validation/documents';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id] - Get document details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const documentId = parseInt(id, 10);

        if (isNaN(documentId) || documentId <= 0) {
          return errorResponse('Invalid document ID', 400);
        }

        const document = await getDocumentById(documentId);

        if (!document) {
          return errorResponse('Document not found', 404);
        }

        return successResponse(document);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}

// PATCH /api/documents/[id] - Update document
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const documentId = parseInt(id, 10);

        if (isNaN(documentId) || documentId <= 0) {
          return errorResponse('Invalid document ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = documentUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const document = await updateDocument(documentId, parseResult.data, session.userId);
        return successResponse(document, 'Document updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Cannot change status')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
