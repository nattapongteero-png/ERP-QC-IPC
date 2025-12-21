// HR Health Records Notifications Check Cron Endpoint
// Feature: 007-hr-personnel-management
// Called by cron job to check for due/overdue health checks and create notifications

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  checkHealthChecksDue,
  checkHealthChecksOverdue,
} from '@/lib/services/hr.service';
import { z } from 'zod';

const querySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
});

// GET /api/hr/health-records/notifications/check - Check for due/overdue health checks
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const withinDays = queryResult.success
          ? queryResult.data.withinDays
          : 30;

        // Check for health checks due within X days
        const dueResult = await checkHealthChecksDue(withinDays);

        // Check for overdue health checks
        const overdueResult = await checkHealthChecksOverdue();

        return successResponse({
          message: 'Health records notifications check completed',
          timestamp: new Date().toISOString(),
          results: {
            due: {
              created: dueResult.created,
              withinDays,
              notifications: dueResult.notifications.map((n) => ({
                id: n.id,
                employeeId: n.employeeId,
                title: n.title,
              })),
            },
            overdue: {
              created: overdueResult.created,
              notifications: overdueResult.notifications.map((n) => ({
                id: n.id,
                employeeId: n.employeeId,
                title: n.title,
              })),
            },
          },
          totalCreated: dueResult.created + overdueResult.created,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
