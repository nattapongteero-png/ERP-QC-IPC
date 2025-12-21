// HR Delegations API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDelegations } from '@/lib/services/hr.service';
import { z } from 'zod';

const delegationQuerySchema = z.object({
  delegatorId: z.coerce.number().int().positive().optional(),
  delegateId: z.coerce.number().int().positive().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

// GET /api/hr/delegations - List all delegations
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = delegationQuerySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters: {
          delegatorId?: number;
          delegateId?: number;
          isActive?: boolean;
        } = {};

        if (queryResult.success) {
          if (queryResult.data.delegatorId) {
            filters.delegatorId = queryResult.data.delegatorId;
          }
          if (queryResult.data.delegateId) {
            filters.delegateId = queryResult.data.delegateId;
          }
          if (queryResult.data.isActive !== undefined) {
            filters.isActive = queryResult.data.isActive === 'true';
          }
        }

        const delegations = await getDelegations(filters);
        return successResponse(delegations);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
