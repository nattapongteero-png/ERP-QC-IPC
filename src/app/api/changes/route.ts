/**
 * Change Control API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 8)
 *
 * GET /api/changes - List change requests with pagination and filters
 * POST /api/changes - Create a new change request
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createChangeRequest, listChangeRequests } from '@/lib/services/change-control-service';
import {
  changeRequestCreateSchema,
  changeRequestListParamsSchema,
} from '@/lib/validation/change-control';

// GET /api/changes - List change requests
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { searchParams } = new URL(request.url);

        // Parse and validate query params
        const parseResult = changeRequestListParamsSchema.safeParse({
          status: searchParams.get('status') || undefined,
          changeType: searchParams.get('changeType') || undefined,
          priority: searchParams.get('priority') || undefined,
          ownerId: searchParams.get('ownerId') || undefined,
          page: searchParams.get('page') || undefined,
          limit: searchParams.get('limit') || undefined,
        });

        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Invalid query parameters', 400, { errors });
        }

        const result = await listChangeRequests(parseResult.data);
        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['change_control:read']
  );
}

// POST /api/changes - Create change request
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = changeRequestCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const change = await createChangeRequest(parseResult.data, session.userId);
        return successResponse(change, 'Change request created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('Invalid')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['change_control:write']
  );
}
