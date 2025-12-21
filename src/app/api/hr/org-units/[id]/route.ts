// HR Organization Unit by ID API
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
  getOrgUnitById,
  updateOrgUnit,
  deactivateOrgUnit,
} from '@/lib/services/hr.service';
import { orgUnitUpdateSchema } from '@/lib/validation/hr';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/org-units/[id] - Get organization unit by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const orgUnit = await getOrgUnitById(Number(id));

        if (!orgUnit) {
          return notFoundResponse('Organization unit not found');
        }

        return successResponse(orgUnit);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/org-units/[id] - Update organization unit
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const body = await request.json();

        // Validate input
        const parseResult = orgUnitUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const orgUnit = await updateOrgUnit(Number(id), parseResult.data);
        return successResponse(orgUnit, 'Organization unit updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Organization unit not found') {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('Separation of duties')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}

// DELETE /api/hr/org-units/[id] - Soft delete organization unit
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        await deactivateOrgUnit(Number(id));
        return successResponse(
          { id: Number(id) },
          'Organization unit deactivated successfully'
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Cannot deactivate')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
