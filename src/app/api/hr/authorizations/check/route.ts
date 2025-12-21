// HR Authorization Check API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { checkAuthorization } from '@/lib/services/hr.service';
import { authorizationCheckSchema } from '@/lib/validation/hr';
import type { AuthorizationType, AuthorizationScope } from '@/types/hr';

// GET /api/hr/authorizations/check - Check if employee is authorized
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const employeeIdParam = searchParams.get('employeeId');
        const authTypeParam = searchParams.get('authType');
        const siteIdParam = searchParams.get('siteId');
        const orgUnitIdParam = searchParams.get('orgUnitId');
        const productLineParam = searchParams.get('productLine');

        // Validate required parameters
        const parseResult = authorizationCheckSchema.safeParse({
          employeeId: employeeIdParam ? Number(employeeIdParam) : undefined,
          authType: authTypeParam,
          siteId: siteIdParam ? Number(siteIdParam) : undefined,
          orgUnitId: orgUnitIdParam ? Number(orgUnitIdParam) : undefined,
          productLine: productLineParam,
        });

        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('employeeId and authType are required', 400, { errors });
        }

        const { employeeId, authType, siteId, orgUnitId, productLine } = parseResult.data;

        // Build scope if any scope params provided
        let scope: AuthorizationScope | undefined;
        if (siteId || orgUnitId || productLine) {
          scope = { siteId, orgUnitId, productLine };
        }

        const result = await checkAuthorization(
          employeeId,
          authType as AuthorizationType,
          scope
        );

        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
