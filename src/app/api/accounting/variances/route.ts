/**
 * Variances List API (T140)
 * GET /api/accounting/variances
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listVariances } from '@/lib/services/variance-analysis.service';
import { varianceListFilterSchema } from '@/lib/validation/variance';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const filters = varianceListFilterSchema.parse({
        workOrderId: searchParams.get('work_order_id'),
        itemId: searchParams.get('item_id'),
        varianceType: searchParams.get('variance_type'),
        dateFrom: searchParams.get('date_from'),
        dateTo: searchParams.get('date_to'),
        isPosted: searchParams.get('is_posted'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const result = await listVariances(filters);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('Error listing variances:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
