// HR Organization Unit Tree API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getOrgUnitTree } from '@/lib/services/hr.service';

// GET /api/hr/org-units/tree - Get organization unit tree structure
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const tree = await getOrgUnitTree();
        return successResponse({ data: tree });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
