// GL Accounts API
// Feature: 010-accounting-module-integration

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listGLAccounts,
  createGLAccount,
  exportChartOfAccounts,
} from '@/lib/services/accounting.service';
import { glAccountCreateSchema } from '@/lib/validation/accounting';

// GET /api/accounting/gl-accounts - List GL accounts
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const accountTypeId = searchParams.get('accountTypeId');
        const parentId = searchParams.get('parentId');
        const isActive = searchParams.get('isActive');
        const isPostable = searchParams.get('isPostable');
        const isBankAccount = searchParams.get('isBankAccount');
        const search = searchParams.get('search') || undefined;
        const exportFormat = searchParams.get('export');

        // Handle export request
        if (exportFormat) {
          const includeInactive = searchParams.get('includeInactive') === 'true';
          const result = await exportChartOfAccounts({
            includeInactive,
            format: exportFormat as 'json' | 'csv',
          });
          return successResponse(result);
        }

        const accounts = await listGLAccounts({
          accountTypeId: accountTypeId ? Number(accountTypeId) : undefined,
          parentId: parentId === 'null' ? null : parentId ? Number(parentId) : undefined,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          isPostable: isPostable === 'true' ? true : isPostable === 'false' ? false : undefined,
          isBankAccount: isBankAccount === 'true' ? true : isBankAccount === 'false' ? false : undefined,
          search,
        });

        return successResponse(accounts);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:read']
  );
}

// POST /api/accounting/gl-accounts - Create GL account
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = glAccountCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const account = await createGLAccount(parseResult.data as Parameters<typeof createGLAccount>[0], session.userId);
        return successResponse(account, 'GL account created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('already exists')) {
            return errorResponse(error.message, 400);
          }
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:gl_accounts:write']
  );
}
