// Confidential Access Groups API
// Feature: BOM Confidentiality Protection (014-unit-cost)

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listConfidentialAccessGroups,
  createConfidentialAccessGroup,
} from '@/lib/services/confidentiality.service';
import { confidentialAccessGroupCreateSchema } from '@/lib/validation/confidentiality';

// GET /api/admin/confidential-groups - List all confidential access groups
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const groups = await listConfidentialAccessGroups();
        return successResponse(groups);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['admin:read']
  );
}

// POST /api/admin/confidential-groups - Create a new confidential access group
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = confidentialAccessGroupCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await createConfidentialAccessGroup(parseResult.data);
        return successResponse(result, 'Confidential access group created successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Duplicate entry') || error.message.includes('UNIQUE constraint')) {
            return errorResponse('Group code already exists', 409);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['admin:write']
  );
}
