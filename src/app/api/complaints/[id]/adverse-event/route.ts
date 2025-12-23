/**
 * Complaint Adverse Event API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/complaints/:id/adverse-event - Record adverse event for complaint
 * GET /api/complaints/:id/adverse-event - Get adverse event for complaint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { recordAdverseEvent, getAdverseEvent } from '@/lib/services/complaint-service';
import { adverseEventCreateSchema } from '@/lib/validation/complaints';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:investigate')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid complaint ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = adverseEventCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const adverseEvent = await recordAdverseEvent(complaintId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: adverseEvent,
    });
  } catch (error) {
    console.error('Error recording adverse event:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to record adverse event' },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid complaint ID' },
        { status: 400 }
      );
    }

    const adverseEvent = await getAdverseEvent(complaintId);

    return NextResponse.json({
      success: true,
      data: adverseEvent,
    });
  } catch (error) {
    console.error('Error fetching adverse event:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch adverse event' },
      { status: 500 }
    );
  }
}
