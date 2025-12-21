// HR Position by ID API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getPositionWithDetails,
  updatePosition,
} from '@/lib/services/hr.service';
import { positionUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/positions/[id] - Get position by ID with details
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const position = await getPositionWithDetails(Number(id));

        if (!position) {
          return notFoundResponse('Position not found');
        }

        return successResponse(position);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/positions/[id] - Update position
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = positionUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const position = await updatePosition(Number(id), parseResult.data);
        return successResponse(position, 'Position updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Position not found') {
            return notFoundResponse(error.message);
          }
          if (error.message === 'Organization unit not found') {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
