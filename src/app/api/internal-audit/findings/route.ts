/**
 * Audit Findings API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/findings - List all findings
 * POST /api/internal-audit/findings - Create new finding
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditFindings, createAuditFinding } from '@/lib/services/internal-audit-service';
import { findingCreateSchema, findingListParamsSchema } from '@/lib/validation/internal-audit';

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
    const parseResult = findingListParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const result = await getAuditFindings(parseResult.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching findings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch findings' },
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
    const parseResult = findingCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const finding = await createAuditFinding(parseResult.data, session.userId);

    return NextResponse.json({ success: true, data: finding }, { status: 201 });
  } catch (error) {
    console.error('Error creating finding:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create finding' },
      { status: 500 }
    );
  }
}
