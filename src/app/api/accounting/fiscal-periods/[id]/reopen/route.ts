/**
 * Fiscal Period Reopen API Route
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 */

import { NextRequest, NextResponse } from 'next/server';
import { reopenFiscalPeriod, getFiscalPeriodById } from '@/lib/services/accounting-period.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const periodId = parseInt(id, 10);

    if (isNaN(periodId)) {
      return NextResponse.json({ error: 'Invalid period ID' }, { status: 400 });
    }

    // Check if period exists
    const period = await getFiscalPeriodById(periodId);
    if (!period) {
      return NextResponse.json({ error: 'Fiscal period not found' }, { status: 404 });
    }

    const body = await request.json();
    const reopenedBy = body.reopenedBy || 1; // TODO: Get from auth
    const reason = body.reason;

    if (!reason) {
      return NextResponse.json(
        { error: 'Reason is required for reopening a period' },
        { status: 400 }
      );
    }

    const result = await reopenFiscalPeriod(periodId, reopenedBy, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Error reopening period:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reopen period' },
      { status: 500 }
    );
  }
}
