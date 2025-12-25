/**
 * Approve/Reject Change Request API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * POST /api/changes/[id]/approve - Approve or reject a change request
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import { approveChange } from '@/lib/services/change-control-service';
import { changeApprovalActionSchema } from '@/lib/validation/change-control';

// POST /api/changes/[id]/approve - Approve or reject change request
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
        const parseResult = changeApprovalActionSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const { role, approved, comments } = parseResult.data;

        const change = await approveChange(
          changeId,
          session.userId,
          role,
          approved,
          comments
        );

        const message = approved
          ? 'Change request approved successfully'
          : 'Change request rejected';

        return successResponse(change, message);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (
            error.message.includes('not pending review') ||
            error.message.includes('No pending approval')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['change_control:approve']
  );
}
