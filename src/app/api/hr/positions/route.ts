// HR Positions API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getPositions,
  createPosition,
} from '@/lib/services/hr.service';
import { positionCreateSchema } from '@/lib/validation/hr';

// GET /api/hr/positions - List positions with optional filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const orgUnitId = searchParams.get('orgUnitId');
        const isActive = searchParams.get('isActive');
        const search = searchParams.get('search');

        const positions = await getPositions({
          orgUnitId: orgUnitId ? Number(orgUnitId) : undefined,
          isActive: isActive ? isActive === 'true' : undefined,
          search: search || undefined,
        });

        return successResponse(positions);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/positions - Create new position
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = positionCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const position = await createPosition(parseResult.data);
        return successResponse(position, 'Position created successfully');
      } catch (error) {
        if (error instanceof Error) {
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
