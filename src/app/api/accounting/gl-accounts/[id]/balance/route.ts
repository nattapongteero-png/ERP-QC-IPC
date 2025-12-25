// GL Account Balance API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getGLAccountBalance } from '@/lib/services/accounting.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/gl-accounts/[id]/balance - Get GL account balance
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const accountId = Number(id);

        if (isNaN(accountId)) {
          return errorResponse('Invalid account ID', 400);
        }

        const { searchParams } = new URL(request.url);
        const asOfDate = searchParams.get('asOfDate') || undefined;

        const balance = await getGLAccountBalance(accountId, asOfDate);
        return successResponse(balance);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:read']
  );
}
