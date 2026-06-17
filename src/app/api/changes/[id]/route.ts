/**
 * Individual Change Request API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * GET /api/changes/[id] - Get change request by ID
 * PUT /api/changes/[id] - Update change request
 * DELETE /api/changes/[id] - Delete a draft change request (guarded)
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
  getChangeRequestById,
  updateChangeRequest,
  deleteChangeRequest,
} from '@/lib/services/change-control-service';
import { changeRequestUpdateSchema } from '@/lib/validation/change-control';

// GET /api/changes/[id] - Get change request by ID
export async function GET(
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

        const change = await getChangeRequestById(changeId);

        if (!change) {
          return notFoundResponse('Change request not found');
        }

        return successResponse(change);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['change_control:read']
  );
}

// PUT /api/changes/[id] - Update change request
export async function PUT(
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
        const parseResult = changeRequestUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const change = await updateChangeRequest(changeId, parseResult.data, session.userId);
        return successResponse(change, 'Change request updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('Cannot update')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['change_control:write']
  );
}

// DELETE /api/changes/[id] - Delete a draft change request
export async function DELETE(
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

        await deleteChangeRequest(changeId, session.userId);
        return successResponse({ id: changeId }, 'Change request deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('Only draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['change_control:write']
  );
}
