/**
 * Complete Audit API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * POST /api/internal-audit/audits/[id]/complete - Complete an audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { completeAudit } from '@/lib/services/internal-audit-service';
import { auditCompleteSchema } from '@/lib/validation/internal-audit';

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
    const auditId = parseInt(id, 10);
    if (isNaN(auditId)) {
      return NextResponse.json({ success: false, error: 'Invalid audit ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = auditCompleteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const audit = await completeAudit(auditId, parseResult.data, session.userId);
    if (!audit) {
      return NextResponse.json(
        { success: false, error: 'Audit not found or cannot be completed' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error('Error completing audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to complete audit' },
      { status: 500 }
    );
  }
}
