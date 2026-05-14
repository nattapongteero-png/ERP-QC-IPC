/**
 * Fiscal Periods API Route
 * Feature: 010-accounting-module-integration
 * User Story 9: Perform Period-End Closing
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listFiscalPeriods } from '@/lib/services/accounting-period.service';
import { fiscalPeriodQuerySchema } from '@/lib/validation/accounting';
import type { FiscalPeriodStatus } from '@/types/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);

      const filters: Record<string, unknown> = {};
      if (searchParams.has('fiscalYearId')) {
        filters.fiscalYearId = parseInt(searchParams.get('fiscalYearId')!, 10);
      }
      if (searchParams.has('status')) {
        filters.status = searchParams.get('status');
      }

      const validation = fiscalPeriodQuerySchema.safeParse(filters);

      let fiscalYearId: number | undefined;
      let status: FiscalPeriodStatus | undefined;

      if (validation.success) {
        fiscalYearId = validation.data.fiscalYearId;
        status = validation.data.status;
      }

      const periods = await listFiscalPeriods(fiscalYearId, status);

      return NextResponse.json({
        success: true,
        data: periods,
        count: periods.length,
      });
    } catch (error) {
      console.error('Error fetching fiscal periods:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fiscal periods' },
        { status: 500 }
      );
    }

  });
}
