/**
 * Recall Notifications API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls/:id/notifications - Get notifications for recall
 * POST /api/recalls/:id/notifications - Create notification
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getRecallNotifications,
  createNotification,
  getRecallById,
} from '@/lib/services/recall-service';
import { recallNotificationCreateSchema } from '@/lib/validation/recalls';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const recallId = parseInt(id, 10);

        if (isNaN(recallId)) {
          return errorResponse('Invalid recall ID', 400);
        }

        const recall = await getRecallById(recallId);
        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        const notifications = await getRecallNotifications(recallId);

        return successResponse(notifications);
      } catch (error) {
        console.error('Error getting notifications:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:read']
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async (session) => {
      try {
        const { id } = await params;
        const recallId = parseInt(id, 10);

        if (isNaN(recallId)) {
          return errorResponse('Invalid recall ID', 400);
        }

        const recall = await getRecallById(recallId);
        if (!recall) {
          return errorResponse('Recall not found', 404);
        }

        const body = await request.json();
        const validatedData = recallNotificationCreateSchema.parse(body);

        const notification = await createNotification(recallId, validatedData, session.userId);

        return NextResponse.json({ success: true, data: notification }, { status: 201 });
      } catch (error) {
        console.error('Error creating notification:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:execute']
  );
}
