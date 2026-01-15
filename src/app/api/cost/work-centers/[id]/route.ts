/**
 * Work Center Detail API
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 *
 * GET /api/cost/work-centers/[id] - Get a specific work center
 * PUT /api/cost/work-centers/[id] - Update a work center
 * DELETE /api/cost/work-centers/[id] - Delete a work center
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getWorkCenter, updateWorkCenter, deleteWorkCenter } from '@/lib/services/unit-cost.service';
import { workCenterUpdateSchema } from '@/lib/validation/unit-cost';

// GET /api/cost/work-centers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workCenterId = parseInt(id);

      if (isNaN(workCenterId)) {
        return errorResponse('Invalid work center ID');
      }

      const workCenter = await getWorkCenter(workCenterId);
      if (!workCenter) {
        return errorResponse('Work center not found', 404);
      }

      return successResponse(workCenter);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}

// PUT /api/cost/work-centers/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workCenterId = parseInt(id);

      if (isNaN(workCenterId)) {
        return errorResponse('Invalid work center ID');
      }

      const body = await request.json();
      const parseResult = workCenterUpdateSchema.safeParse(body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return errorResponse('Validation failed', 400, { errors });
      }

      await updateWorkCenter(workCenterId, parseResult.data);
      return successResponse({ id: workCenterId }, 'Work center updated successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(error.message, 404);
      }
      if (error instanceof Error && error.message.includes('already exists')) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  }, ['cost:write']);
}

// DELETE /api/cost/work-centers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workCenterId = parseInt(id);

      if (isNaN(workCenterId)) {
        return errorResponse('Invalid work center ID');
      }

      await deleteWorkCenter(workCenterId);
      return successResponse({ id: workCenterId }, 'Work center deleted successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(error.message, 404);
      }
      if (error instanceof Error && error.message.includes('Cannot delete')) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  }, ['cost:write']);
}
