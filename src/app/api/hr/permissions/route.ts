// HR Permissions API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAppPermissions } from '@/lib/services/hr.service';

// GET /api/hr/permissions - List all application permissions
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const permissions = await getAppPermissions();
        return successResponse(permissions);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
