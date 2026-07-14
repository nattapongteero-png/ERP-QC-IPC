/**
 * Fiscal Years API Route
 *
 * GET  - list fiscal years (the period-close page calls this; the route did not exist)
 * POST - create a fiscal year together with all 12 of its monthly periods
 *
 * A year whose periods were never generated blocks all journal posting from the first
 * missing month onward, because createJournalEntry requires a fiscal period for the
 * entry date. FY2026 shipped with only January, which is why entries stopped in February.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  listFiscalYears,
  createFiscalYear,
} from '@/lib/services/accounting-period.service';
import type { FiscalYearStatus } from '@/types/accounting';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const statusParam = searchParams.get('status');
      const status =
        statusParam === 'open' || statusParam === 'closed'
          ? (statusParam as FiscalYearStatus)
          : undefined;

      const years = await listFiscalYears(status);

      return NextResponse.json({
        success: true,
        data: years,
        count: years.length,
      });
    } catch (error) {
      console.error('Error fetching fiscal years:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fiscal years' },
        { status: 500 }
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();
        const year = Number(body.year);

        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
          return NextResponse.json(
            { error: 'year must be an integer between 2000 and 2100' },
            { status: 400 }
          );
        }

        const fiscalYear = await createFiscalYear(year, session.userId, {
          setCurrent: Boolean(body.setCurrent),
        });

        return NextResponse.json({ success: true, data: fiscalYear }, { status: 201 });
      } catch (error) {
        console.error('Error creating fiscal year:', error);
        const message =
          error instanceof Error ? error.message : 'Failed to create fiscal year';
        return NextResponse.json({ error: message }, { status: 400 });
      }
    },
    ['accounting:fiscal_periods:write']
  );
}
