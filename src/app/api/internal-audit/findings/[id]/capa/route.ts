/**
 * Assign CAPA to Finding API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * POST /api/internal-audit/findings/[id]/capa - Assign CAPA to finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { assignCapaToFinding } from '@/lib/services/internal-audit-service';
import { assignCapaSchema } from '@/lib/validation/internal-audit';

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

    const body = await request.json();
    const parseResult = assignCapaSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const finding = await assignCapaToFinding(findingId, parseResult.data.capaId, session.userId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: finding });
  } catch (error) {
    console.error('Error assigning CAPA to finding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign CAPA' },
      { status: 500 }
    );
  }
}
