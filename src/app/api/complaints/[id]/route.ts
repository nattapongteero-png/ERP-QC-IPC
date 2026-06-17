/**
 * Complaint Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/complaints/:id - Get complaint details
 * PATCH /api/complaints/:id - Update complaint
 * DELETE /api/complaints/:id - Delete a received complaint (guarded)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getComplaintDetails, updateComplaint, deleteComplaint } from '@/lib/services/complaint-service';
import { complaintUpdateSchema } from '@/lib/validation/complaints';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const complaint = await getComplaintDetails(complaintId);
    if (!complaint) {
      return NextResponse.json(
        { success: false, error: 'Complaint not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error('Error fetching complaint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch complaint' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:write')) {
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
    const parseResult = complaintUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const complaint = await updateComplaint(complaintId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    console.error('Error updating complaint:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update complaint' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:write')) {
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

    await deleteComplaint(complaintId, session.userId);

    return NextResponse.json({ success: true, data: { id: complaintId } });
  } catch (error) {
    console.error('Error deleting complaint:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete complaint';
    const status = message.includes('Only complaints') ? 400 : message.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
