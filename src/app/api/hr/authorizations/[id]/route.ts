// HR Authorization by ID API
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
  getAuthorizationById,
  updateAuthorization,
  revokeAuthorization,
} from '@/lib/services/hr.service';
import { authorizationUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/authorizations/[id] - Get authorization by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const authorization = await getAuthorizationById(Number(id));

        if (!authorization) {
          return notFoundResponse('Authorization not found');
        }

        return successResponse(authorization);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/authorizations/[id] - Update authorization (e.g., set effectiveTo)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = authorizationUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const authorization = await updateAuthorization(Number(id), parseResult.data);
        return successResponse(authorization, 'Authorization updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Authorization not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}

// DELETE /api/hr/authorizations/[id] - Revoke authorization
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const authorization = await revokeAuthorization(Number(id), session.userId);
        return successResponse(authorization, 'Authorization revoked successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Authorization not found') {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
