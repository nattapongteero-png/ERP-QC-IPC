/**
 * Fiscal Period Close API Route
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { closeFiscalPeriod, softCloseFiscalPeriod, getFiscalPeriodById } from '@/lib/services/accounting-period.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
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
      const closedBy = session.userId; // TODO: Get from auth
      const force = body.force || false;
      const softClose = body.softClose || false;

      let result;
      if (softClose) {
        result = await softCloseFiscalPeriod(periodId, closedBy);
      } else {
        result = await closeFiscalPeriod(periodId, closedBy, force);
      }

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
      console.error('Error closing period:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to close period' },
        { status: 500 }
      );
    }

  });
}
