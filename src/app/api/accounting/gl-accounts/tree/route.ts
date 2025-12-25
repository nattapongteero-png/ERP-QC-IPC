// GL Accounts Tree API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getGLAccountTree } from '@/lib/services/accounting.service';

// GET /api/accounting/gl-accounts/tree - Get GL accounts as tree
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const tree = await getGLAccountTree();
        return successResponse(tree);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:read']
  );
}
