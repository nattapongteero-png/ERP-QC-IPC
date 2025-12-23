/**
 * PQR Individual API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/pqr/[id] - Get a specific PQR report
 * PATCH /api/pqr/[id] - Update a PQR report
 * DELETE /api/pqr/[id] - Delete a PQR report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getPqrById, updatePqrReport, deletePqrReport } from '@/lib/services/pqr-service';

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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'pqr:read')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pqrId = parseInt(id);

    if (isNaN(pqrId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PQR ID' },
        { status: 400 }
      );
    }

    const report = await getPqrById(pqrId);

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'PQR report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error fetching PQR report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch PQR report' },
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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'pqr:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pqrId = parseInt(id);

    if (isNaN(pqrId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PQR ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const report = await updatePqrReport(pqrId, body, session.userId);

    if (!report) {
      return NextResponse.json(
        { success: false, error: 'PQR report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error updating PQR report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update PQR report' },
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

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'pqr:delete')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const pqrId = parseInt(id);

    if (isNaN(pqrId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PQR ID' },
        { status: 400 }
      );
    }

    await deletePqrReport(pqrId);

    return NextResponse.json({
      success: true,
      message: 'PQR report deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting PQR report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete PQR report' },
      { status: 500 }
    );
  }
}
