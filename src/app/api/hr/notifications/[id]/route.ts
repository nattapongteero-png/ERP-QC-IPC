// HR Notification Detail API
// Feature: 007-hr-personnel-management

import { NextRequest } from 'next/server';
import {
  successResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getNotificationById,
  markNotificationRead,
  deleteNotification,
} from '@/lib/services/hr.service';

// GET /api/hr/notifications/[id] - Get notification details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const notificationId = parseInt(id, 10);
        if (isNaN(notificationId)) {
          return notFoundResponse('Notification not found');
        }

        const notification = await getNotificationById(notificationId);
        if (!notification) {
          return notFoundResponse('Notification not found');
        }

        return successResponse(notification);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:read']
  );
}

// PUT /api/hr/notifications/[id] - Mark notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const notificationId = parseInt(id, 10);
        if (isNaN(notificationId)) {
          return notFoundResponse('Notification not found');
        }

        const notification = await getNotificationById(notificationId);
        if (!notification) {
          return notFoundResponse('Notification not found');
        }

        await markNotificationRead(notificationId);

        return successResponse({
          message: 'Notification marked as read',
          id: notificationId,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}

// DELETE /api/hr/notifications/[id] - Delete notification
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const notificationId = parseInt(id, 10);
        if (isNaN(notificationId)) {
          return notFoundResponse('Notification not found');
        }

        const notification = await getNotificationById(notificationId);
        if (!notification) {
          return notFoundResponse('Notification not found');
        }

        await deleteNotification(notificationId);

        return successResponse({
          message: 'Notification deleted',
          id: notificationId,
        });
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['hr:write']
  );
}
