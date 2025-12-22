/**
 * Audit Plan Detail API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * GET /api/internal-audit/plans/[id] - Get plan details
 * PATCH /api/internal-audit/plans/[id] - Update plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { getAuditPlanById, updateAuditPlan } from '@/lib/services/internal-audit-service';
import { planUpdateSchema } from '@/lib/validation/internal-audit';

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
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: 'Invalid plan ID' }, { status: 400 });
    }

    const plan = await getAuditPlanById(planId);
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error fetching audit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit plan' },
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
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: 'Invalid plan ID' }, { status: 400 });
    }

    const body = await request.json();
    const parseResult = planUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const plan = await updateAuditPlan(planId, parseResult.data, session.userId);
    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error updating audit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update audit plan' },
      { status: 500 }
    );
  }
}
