/**
 * Start Audit API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * POST /api/internal-audit/audits/[id]/start - Start an audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { startAudit } from '@/lib/services/internal-audit-service';

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

    const audit = await startAudit(auditId, session.userId);
    if (!audit) {
      return NextResponse.json(
        { success: false, error: 'Audit not found or cannot be started' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error('Error starting audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start audit' },
      { status: 500 }
    );
  }
}
