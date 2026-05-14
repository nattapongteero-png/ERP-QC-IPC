/**
 * Matching Exceptions List API (T113)
 * GET /api/accounting/matching/exceptions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listExceptions } from '@/lib/services/matching.service';
import { exceptionListFilterSchema } from '@/lib/validation/matching';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const filter = exceptionListFilterSchema.parse({
        status: searchParams.get('status'),
        exceptionType: searchParams.get('exceptionType'),
        vendorId: searchParams.get('vendorId'),
        fromDate: searchParams.get('fromDate'),
        toDate: searchParams.get('toDate'),
        search: searchParams.get('search'),
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const result = await listExceptions(filter);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('Error listing exceptions:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
