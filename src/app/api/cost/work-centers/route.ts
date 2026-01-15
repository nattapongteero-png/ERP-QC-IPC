/**
 * Work Centers API
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 *
 * GET /api/cost/work-centers - List all work centers
 * POST /api/cost/work-centers - Create a new work center
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listWorkCenters, createWorkCenter } from '@/lib/services/unit-cost.service';
import { workCenterCreateSchema } from '@/lib/validation/unit-cost';

// GET /api/cost/work-centers
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const url = new URL(request.url);
      const isActive = url.searchParams.get('isActive');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

      const result = await listWorkCenters({
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search || undefined,
        page,
        pageSize,
      });

      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}

// POST /api/cost/work-centers
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const parseResult = workCenterCreateSchema.safeParse(body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return errorResponse('Validation failed', 400, { errors });
      }

      const result = await createWorkCenter(parseResult.data);
      return successResponse(result, 'Work center created successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  }, ['cost:write']);
}
