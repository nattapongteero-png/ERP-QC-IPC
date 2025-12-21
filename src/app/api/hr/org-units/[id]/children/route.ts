// HR Organization Unit Children API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getOrgUnitById, getOrgUnitChildren } from '@/lib/services/hr.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/hr/org-units/[id]/children - Get children of an organization unit
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const parentId = Number(id);

        // Verify parent exists
        const parent = await getOrgUnitById(parentId);
        if (!parent) {
          return notFoundResponse('Organization unit not found');
        }

        const children = await getOrgUnitChildren(parentId);
        return successResponse({ data: children });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
