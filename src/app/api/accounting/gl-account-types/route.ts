// GL Account Types API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listGLAccountTypes } from '@/lib/services/accounting.service';

// GET /api/accounting/gl-account-types - List GL account types
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const types = await listGLAccountTypes();
        return successResponse(types);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_account_types:read']
  );
}
