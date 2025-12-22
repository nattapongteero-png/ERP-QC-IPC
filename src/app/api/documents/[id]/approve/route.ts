/**
 * Document Submit for Approval API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 5)
 *
 * POST /api/documents/[id]/approve - Submit document version for approval
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { submitForApproval } from '@/lib/services/document-service';
import { submitApprovalSchema } from '@/lib/validation/documents';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/documents/[id]/approve - Submit for approval
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
        const parseResult = submitApprovalSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await submitForApproval(
          parseResult.data.versionId,
          parseResult.data.approvers,
          session.userId
        );

        return successResponse(result, 'Document submitted for approval');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Only draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['documents:write']
  );
}
