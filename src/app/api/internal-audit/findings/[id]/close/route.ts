/**
 * Close Finding API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * POST /api/internal-audit/findings/[id]/close - Close a finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { closeAuditFinding } from '@/lib/services/internal-audit-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const finding = await closeAuditFinding(findingId, session.userId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: finding });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to close finding';
    console.error('Error closing finding:', error);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
