/**
 * Fiscal Period Validation API Route
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePeriodClose, getFiscalPeriodById } from '@/lib/services/accounting-period.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const validation = await validatePeriodClose(periodId);

    return NextResponse.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    console.error('Error validating period close:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate period close' },
      { status: 500 }
    );
  }
}
