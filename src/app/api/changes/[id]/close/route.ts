/**
 * Close Change Request API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * POST /api/changes/[id]/close - Close change request after verification
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { closeChange } from '@/lib/services/change-control-service';
import { changeCloseSchema } from '@/lib/validation/change-control';

// POST /api/changes/[id]/close - Close change request
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

        const body = await request.json();

        // Validate input
        const parseResult = changeCloseSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const { closureNotes } = parseResult.data;

        const change = await closeChange(changeId, session.userId, closureNotes);
        return successResponse(change, 'Change request closed successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('Only implemented') ||
            error.message.includes('must have an implementation date')
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
