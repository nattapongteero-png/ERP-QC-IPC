/**
 * Document Versions API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * GET /api/documents/[id]/versions - Get version history
 * POST /api/documents/[id]/versions - Create new version
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getVersionHistory, createVersion } from '@/lib/services/document-service';
import { versionCreateSchema } from '@/lib/validation/documents';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id]/versions - Get version history
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

        const versions = await getVersionHistory(documentId);
        return successResponse(versions);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:read']
  );
}

// POST /api/documents/[id]/versions - Create new version
export async function POST(request: NextRequest, { params }: RouteParams) {
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
        const parseResult = versionCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const version = await createVersion(
          {
            documentId,
            ...parseResult.data,
          },
          session.userId
        );

        return successResponse(version, 'Version created successfully');
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
