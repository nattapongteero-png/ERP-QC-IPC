// HR Organization Units API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getOrgUnits, createOrgUnit } from '@/lib/services/hr.service';
import { orgUnitCreateSchema } from '@/lib/validation/hr';

// GET /api/hr/org-units - List organization units
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || undefined;
        const parentId = searchParams.get('parentId');
        const siteId = searchParams.get('siteId');
        const isActive = searchParams.get('isActive');
        const search = searchParams.get('search') || undefined;

        const orgUnits = await getOrgUnits({
          type,
          parentId: parentId === 'null' ? null : parentId ? Number(parentId) : undefined,
          siteId: siteId ? Number(siteId) : undefined,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          search,
        });

        return successResponse({ data: orgUnits });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// POST /api/hr/org-units - Create organization unit
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = orgUnitCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const orgUnit = await createOrgUnit(parseResult.data);
        return successResponse(orgUnit, 'Organization unit created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Separation of duties')) {
            return errorResponse(error.message, 400);
          }
          if (error.message.includes('Invalid hierarchy')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
