/**
 * Audit Plans API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/plans - List all audit plans
 * POST /api/internal-audit/plans - Create new audit plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditPlans, createAuditPlan } from '@/lib/services/internal-audit-service';
import { planCreateSchema, planListParamsSchema } from '@/lib/validation/internal-audit';

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
    const parseResult = planListParamsSchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const plans = await getAuditPlans(parseResult.data);

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('Error fetching audit plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit plans' },
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
    const parseResult = planCreateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.errors },
        { status: 400 }
      );
    }

    const plan = await createAuditPlan(parseResult.data, session.userId);

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating audit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create audit plan' },
      { status: 500 }
    );
  }
}
