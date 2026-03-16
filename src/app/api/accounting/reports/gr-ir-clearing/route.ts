/**
 * GR/IR Clearing Report API (T116)
 * GET /api/accounting/reports/gr-ir-clearing
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getGRIRClearingReport } from '@/lib/services/matching.service';
import { grirReportFilterSchema } from '@/lib/validation/matching';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const filter = grirReportFilterSchema.parse({
        asOfDate: searchParams.get('asOfDate'),
        vendorId: searchParams.get('vendorId'),
        status: searchParams.get('status'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const report = await getGRIRClearingReport(filter);
      return NextResponse.json({ success: true, data: report });
    } catch (error) {
      console.error('Error getting GR/IR clearing report:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
