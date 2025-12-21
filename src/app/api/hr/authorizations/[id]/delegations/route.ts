// HR Authorization Delegations API
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
  getDelegations,
  createDelegation,
  getAuthorizationById,
} from '@/lib/services/hr.service';
import { delegationCreateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/authorizations/[id]/delegations - List delegations for authorization
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const authorizationId = Number(id);

        // Check authorization exists
        const authorization = await getAuthorizationById(authorizationId);
        if (!authorization) {
          return notFoundResponse('Authorization not found');
        }

        const delegations = await getDelegations({ authorizationId });
        return successResponse(delegations);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/authorizations/[id]/delegations - Create delegation
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const authorizationId = Number(id);
        const body = await request.json();

        // Check authorization exists
        const authorization = await getAuthorizationById(authorizationId);
        if (!authorization) {
          return notFoundResponse('Authorization not found');
        }

        // Validate input with authorizationId from URL
        const parseResult = delegationCreateSchema.safeParse({
          ...body,
          authorizationId,
        });
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        // The delegator is the authorization owner (must be the current user)
        if (authorization.employeeId !== session.userId) {
          return errorResponse('Only the authorization owner can create delegations', 403);
        }

        const delegation = await createDelegation(parseResult.data, session.userId);
        return successResponse(delegation, 'Delegation created successfully');
      } catch (error) {
        if (error instanceof Error) {
          // Handle business logic errors
          if (
            error.message.includes('delegate') ||
            error.message.includes('authorization') ||
            error.message.includes('date')
          ) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
