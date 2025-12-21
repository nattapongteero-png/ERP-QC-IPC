// HR Health Records Due API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getHealthChecksDue } from '@/lib/services/hr.service';
import { z } from 'zod';

const querySchema = z.object({
  withinDays: z.coerce.number().int().positive().default(30),
});

// GET /api/hr/health-records/due - Get health checks due within specified days
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const withinDays = queryResult.success ? queryResult.data.withinDays : 30;

        const upcoming = await getHealthChecksDue(withinDays);
        return successResponse(upcoming);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}
