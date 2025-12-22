/**
 * Approve Audit Plan API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 10)
 *
 * POST /api/internal-audit/plans/[id]/approve - Approve a plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasPermission, type Role } from '@/lib/auth';
import { approveAuditPlan } from '@/lib/services/internal-audit-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as Role, 'audit:approve')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const planId = parseInt(id, 10);
    if (isNaN(planId)) {
      return NextResponse.json({ success: false, error: 'Invalid plan ID' }, { status: 400 });
    }

    const plan = await approveAuditPlan(planId, session.userId);
    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found or cannot be approved' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error('Error approving audit plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve audit plan' },
      { status: 500 }
    );
  }
}
