// HR Authorizations API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAuthorizations, createAuthorization } from '@/lib/services/hr.service';
import { authorizationCreateSchema, authorizationQuerySchema } from '@/lib/validation/hr';
import type { AuthorizationType } from '@/types/hr';

// GET /api/hr/authorizations - List authorizations
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = authorizationQuerySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters: {
          employeeId?: number;
          authType?: AuthorizationType;
          scopeSiteId?: number;
          isActive?: boolean;
        } = {};

        if (queryResult.success) {
          if (queryResult.data.employeeId) {
            filters.employeeId = queryResult.data.employeeId;
          }
          if (queryResult.data.authType) {
            filters.authType = queryResult.data.authType;
          }
          if (queryResult.data.siteId) {
            filters.scopeSiteId = queryResult.data.siteId;
          }
          if (queryResult.data.isActive !== undefined) {
            filters.isActive = queryResult.data.isActive === 'true';
          }
        }

        const authorizations = await getAuthorizations(filters);
        return successResponse(authorizations);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/authorizations - Grant authorization
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = authorizationCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const authorization = await createAuthorization(parseResult.data, session.userId);
        return successResponse(authorization, 'Authorization granted successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
