/**
 * Audit Finding Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/findings/[id] - Get finding details
 * PATCH /api/internal-audit/findings/[id] - Update finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditFindingById, updateAuditFinding } from '@/lib/services/internal-audit-service';
import { findingUpdateSchema } from '@/lib/validation/internal-audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'audit:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const findingId = parseInt(id, 10);
    if (isNaN(findingId)) {
      return NextResponse.json({ success: false, error: 'Invalid finding ID' }, { status: 400 });
    }

    const finding = await getAuditFindingById(findingId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: finding });
  } catch (error) {
    console.error('Error fetching finding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch finding' },
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

    if (!hasPermission(session.role as Role, 'audit:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const findingId = parseInt(id, 10);
    if (isNaN(findingId)) {
      return NextResponse.json({ success: false, error: 'Invalid finding ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = findingUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const finding = await updateAuditFinding(findingId, parseResult.data, session.userId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: finding });
  } catch (error) {
    console.error('Error updating finding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update finding' },
      { status: 500 }
    );
  }
}
