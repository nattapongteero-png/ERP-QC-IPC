/**
 * Matching Results API (T112)
 * GET /api/accounting/matching/results/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getMatchingResultByInvoice } from '@/lib/services/matching.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const invoiceId = parseInt(id, 10);

      if (isNaN(invoiceId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid invoice ID' },
          { status: 400 }
        );
      }

      const result = await getMatchingResultByInvoice(invoiceId);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error getting matching results:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
