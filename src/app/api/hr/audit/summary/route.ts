// HR Audit Summary API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAuditSummary } from '@/lib/services/hr.service';
import { z } from 'zod';

const querySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});

// GET /api/hr/audit/summary - Get audit activity summary
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const fromDate = queryResult.success ? queryResult.data.fromDate : undefined;
        const toDate = queryResult.success ? queryResult.data.toDate : undefined;

        const summary = await getAuditSummary(fromDate, toDate);
        return successResponse(summary);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
