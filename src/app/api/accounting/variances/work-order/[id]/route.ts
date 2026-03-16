/**
 * Work Order Variances API (T141)
 * GET /api/accounting/variances/work-order/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getWorkOrderVariances } from '@/lib/services/variance-analysis.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const workOrderId = parseInt(id, 10);

      if (isNaN(workOrderId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid work order ID' },
          { status: 400 }
        );
      }

      const variances = await getWorkOrderVariances(workOrderId);
      if (!variances) {
        return NextResponse.json(
          { success: false, error: 'Work order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: variances });
    } catch (error) {
      console.error('Error fetching work order variances:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
