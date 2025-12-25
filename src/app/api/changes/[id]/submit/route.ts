/**
 * Submit Change Request for Review API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * POST /api/changes/[id]/submit - Submit change request for review
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { submitChangeForReview } from '@/lib/services/change-control-service';

// POST /api/changes/[id]/submit - Submit change request for review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const changeId = parseInt(id, 10);

        if (isNaN(changeId)) {
          return errorResponse('Invalid change request ID', 400);
        }

        const change = await submitChangeForReview(changeId, session.userId);
        return successResponse(change, 'Change request submitted for review successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Only draft') ||
            error.message.includes('required before submitting')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['change_control:write']
  );
}
