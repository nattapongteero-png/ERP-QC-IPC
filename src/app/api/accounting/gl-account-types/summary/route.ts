import { NextRequest } from 'next/server';
import { successResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { listGLAccountTypesWithSummary } from '@/lib/services/accounting.service';

// GET /api/accounting/gl-account-types/summary
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const data = await listGLAccountTypesWithSummary();
        return successResponse(data);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_account_types:read']
  );
}
