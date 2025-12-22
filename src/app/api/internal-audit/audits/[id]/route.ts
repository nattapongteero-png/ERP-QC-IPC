/**
 * Audit Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/audits/[id] - Get audit details
 * PATCH /api/internal-audit/audits/[id] - Update audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditById, updateAudit } from '@/lib/services/internal-audit-service';
import { auditUpdateSchema } from '@/lib/validation/internal-audit';

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
    const auditId = parseInt(id, 10);
    if (isNaN(auditId)) {
      return NextResponse.json({ success: false, error: 'Invalid audit ID' }, { status: 400 });
    }

    const audit = await getAuditById(auditId);
    if (!audit) {
      return NextResponse.json({ success: false, error: 'Audit not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error('Error fetching audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit' },
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
    const auditId = parseInt(id, 10);
    if (isNaN(auditId)) {
      return NextResponse.json({ success: false, error: 'Invalid audit ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = auditUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const audit = await updateAudit(auditId, parseResult.data, session.userId);
    if (!audit) {
      return NextResponse.json({ success: false, error: 'Audit not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error('Error updating audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update audit' },
      { status: 500 }
    );
  }
}
