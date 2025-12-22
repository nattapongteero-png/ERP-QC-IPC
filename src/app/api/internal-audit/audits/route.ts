/**
 * Audits API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/audits - List all audits
 * POST /api/internal-audit/audits - Create new audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAudits, createAudit } from '@/lib/services/internal-audit-service';
import { auditCreateSchema, auditListParamsSchema } from '@/lib/validation/internal-audit';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'audit:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = auditListParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await getAudits(parseResult.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching audits:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audits' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'audit:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parseResult = auditCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const audit = await createAudit(parseResult.data, session.userId);

    return NextResponse.json({ success: true, data: audit }, { status: 201 });
  } catch (error) {
    console.error('Error creating audit:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit' },
      { status: 500 }
    );
  }
}
