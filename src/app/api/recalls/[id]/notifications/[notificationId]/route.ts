/**
 * Recall Notification Detail API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * PATCH /api/recalls/:id/notifications/:notificationId - Update notification
 */

import { NextRequest, NextResponse } from 'next/server';


import { getSession, hasPermission } from '@/lib/auth';
import { updateNotification } from '@/lib/services/recall-service';
import { recallNotificationUpdateSchema } from '@/lib/validation/recalls';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notificationId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:execute')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { notificationId } = await params;
    const notifId = parseInt(notificationId, 10);

    if (isNaN(notifId)) {
      return NextResponse.json({ success: false, error: 'Invalid notification ID' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = recallNotificationUpdateSchema.parse(body);

    const notification = await updateNotification(notifId, validatedData, session.userId);

    if (!notification) {
      return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    const message = error instanceof Error ? error.message : 'Failed to update notification';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
