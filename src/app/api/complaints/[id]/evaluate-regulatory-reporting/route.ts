/**
 * Complaint Regulatory Reporting Evaluation API
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * POST /api/complaints/:id/evaluate-regulatory-reporting - Evaluate if complaint requires regulatory reporting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { evaluateRegulatoryReporting } from '@/lib/services/complaint-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'complaints:investigate')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const complaintId = parseInt(id, 10);
    if (isNaN(complaintId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid complaint ID' },
        { status: 400 }
      );
    }

    const evaluation = await evaluateRegulatoryReporting(complaintId, session.userId);

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    console.error('Error evaluating regulatory reporting:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to evaluate regulatory reporting' },
      { status: 500 }
    );
  }
}
