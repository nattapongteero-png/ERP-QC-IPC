/**
 * Recall Notification Detail API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * PATCH /api/recalls/:id/notifications/:notificationId - Update notification
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { updateNotification } from '@/lib/services/recall-service';
import { recallNotificationUpdateSchema } from '@/lib/validation/recalls';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { notificationId } = await params;
        const notifId = parseInt(notificationId, 10);

        if (isNaN(notifId)) {
          return errorResponse('Invalid notification ID', 400);
        }

        const body = await request.json();
        const validatedData = recallNotificationUpdateSchema.parse(body);

        const notification = await updateNotification(notifId, validatedData, session.userId);

        if (!notification) {
          return errorResponse('Notification not found', 404);
        }

        return successResponse(notification);
      } catch (error) {
        console.error('Error updating notification:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:execute']
  );
}
