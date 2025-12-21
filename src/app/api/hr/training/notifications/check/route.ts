// HR Training Notifications Check Cron Endpoint
// Feature: 007-hr-personnel-management
// Called by cron job to check for expiring/expired training and create notifications

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  checkTrainingExpirations,
  checkTrainingExpired,
} from '@/lib/services/hr.service';
import { z } from 'zod';

const querySchema = z.object({
  withinDays: z.coerce.number().int().min(1).max(365).default(30),
});

// GET /api/hr/training/notifications/check - Check for training expiring/expired
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

        // Check for expiring training (within X days)
        const expiringResult = await checkTrainingExpirations(withinDays);

        // Check for already expired training
        const expiredResult = await checkTrainingExpired();

        return successResponse({
          message: 'Training notifications check completed',
          timestamp: new Date().toISOString(),
          results: {
            expiring: {
              created: expiringResult.created,
              withinDays,
              notifications: expiringResult.notifications.map((n) => ({
                id: n.id,
                employeeId: n.employeeId,
                title: n.title,
              })),
            },
            expired: {
              created: expiredResult.created,
              notifications: expiredResult.notifications.map((n) => ({
                id: n.id,
                employeeId: n.employeeId,
                title: n.title,
              })),
            },
          },
          totalCreated: expiringResult.created + expiredResult.created,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
