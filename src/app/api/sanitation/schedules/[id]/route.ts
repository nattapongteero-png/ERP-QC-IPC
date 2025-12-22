/**
 * Sanitation Schedule Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 4)
 *
 * GET /api/sanitation/schedules/[id] - Get schedule details
 * PATCH /api/sanitation/schedules/[id] - Update schedule
 * DELETE /api/sanitation/schedules/[id] - Delete schedule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import {
  getSanitationScheduleById,
  updateSanitationSchedule,
  deleteSanitationSchedule,
} from '@/lib/services/sanitation-service';
import { scheduleUpdateSchema } from '@/lib/validation/sanitation';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ success: false, error: 'Invalid schedule ID' }, { status: 400 });
    }

    const schedule = await getSanitationScheduleById(scheduleId);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error fetching sanitation schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ success: false, error: 'Invalid schedule ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = scheduleUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const schedule = await updateSanitationSchedule(scheduleId, parseResult.data, session.userId);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error('Error updating sanitation schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'sanitation:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const scheduleId = parseInt(id, 10);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ success: false, error: 'Invalid schedule ID' }, { status: 400 });
    }

    const deleted = await deleteSanitationSchedule(scheduleId, session.userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    console.error('Error deleting sanitation schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
