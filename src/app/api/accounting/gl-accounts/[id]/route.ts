// GL Account Single Item API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getGLAccountById,
  updateGLAccount,
  deactivateGLAccount,
  deleteGLAccount,
} from '@/lib/services/accounting.service';
import { glAccountUpdateSchema } from '@/lib/validation/accounting';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/accounting/gl-accounts/[id] - Get GL account by ID
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

        const account = await getGLAccountById(accountId);
        if (!account) {
          return notFoundResponse('GL account not found');
        }

        return successResponse(account);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:read']
  );
}

// PUT /api/accounting/gl-accounts/[id] - Update GL account
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const accountId = Number(id);

        if (isNaN(accountId)) {
          return errorResponse('Invalid account ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = glAccountUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const account = await updateGLAccount(accountId, parseResult.data as Parameters<typeof updateGLAccount>[1], session.userId);
        return successResponse(account, 'GL account updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:write']
  );
}

// DELETE /api/accounting/gl-accounts/[id] - Delete or deactivate GL account
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const accountId = Number(id);

        if (isNaN(accountId)) {
          return errorResponse('Invalid account ID', 400);
        }

        const { searchParams } = new URL(request.url);
        const softDelete = searchParams.get('soft') !== 'false'; // Default to soft delete

        if (softDelete) {
          const account = await deactivateGLAccount(accountId, session.userId);
          return successResponse(account, 'GL account deactivated successfully');
        } else {
          await deleteGLAccount(accountId, session.userId);
          return successResponse(null, 'GL account deleted successfully');
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return notFoundResponse(error.message);
          }
          if (error.message.includes('Cannot')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:delete']
  );
}
