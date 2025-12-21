// HR Notifications API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getEmployeeNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  getAllPendingNotifications,
} from '@/lib/services/hr.service';
import { z } from 'zod';
import type { NotificationType } from '@/types/hr';

const querySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  unreadOnly: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.string().optional(),
});

// GET /api/hr/notifications - List notifications
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const queryResult = querySchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        if (queryResult.success && queryResult.data.employeeId) {
          // Get notifications for a specific employee
          const notifications = await getEmployeeNotifications(
            queryResult.data.employeeId,
            {
              unreadOnly: queryResult.data.unreadOnly,
              limit: queryResult.data.limit,
            }
          );
          const unreadCount = await getUnreadNotificationCount(
            queryResult.data.employeeId
          );
          return successResponse({
            data: notifications,
            unreadCount,
          });
        } else {
          // Get all pending notifications (for admin dashboard)
          const notifications = await getAllPendingNotifications({
            limit: queryResult.success ? queryResult.data.limit : 50,
            type: queryResult.success
              ? (queryResult.data.type as NotificationType | undefined)
              : undefined,
          });
          return successResponse({
            data: notifications,
            total: notifications.length,
          });
        }
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/notifications - Mark all notifications as read for an employee
export async function PUT(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const body = await request.json();
        const employeeId = z.coerce.number().int().positive().parse(body.employeeId);

        await markAllNotificationsRead(employeeId);

        return successResponse({
          message: 'All notifications marked as read',
          employeeId,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:admin']
  );
}
