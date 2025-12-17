import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { calculateYield, recordProductionOutput } from '@/lib/services/production.service';
import { getProductionYieldReport } from '@/lib/services/reports.service';

// GET - Get yield calculation for a work order
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const workOrderId = parseInt(searchParams.get('workOrderId') || '0');
      const dateFrom = searchParams.get('dateFrom') || undefined;
      const dateTo = searchParams.get('dateTo') || undefined;

      if (workOrderId) {
        // Get yield for specific work order
        const yieldResult = await calculateYield(workOrderId);
        return successResponse(yieldResult);
      } else {
        // Get yield report for date range
        const report = await getProductionYieldReport(dateFrom, dateTo);
        return successResponse(report);
      }
    } catch (error) {
      console.error('Yield calculation error:', error);
      return errorResponse('Failed to calculate yield', 500);
    }
  });
}

// POST - Record production output
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { workOrderId, actualQuantity, rejectQuantity, warehouseId } = body;

      if (!workOrderId || actualQuantity === undefined || !warehouseId) {
        return errorResponse('workOrderId, actualQuantity, and warehouseId are required', 400);
      }

      const lotId = await recordProductionOutput(
        workOrderId,
        actualQuantity,
        rejectQuantity || 0,
        warehouseId,
        user.userId
      );

      const yieldResult = await calculateYield(workOrderId);

      return successResponse({
        lotId,
        yield: yieldResult,
        message: yieldResult.status === 'low_yield' 
          ? 'Warning: Yield is below target. Deviation may be required.'
          : 'Production output recorded successfully',
      });
    } catch (error) {
      console.error('Record output error:', error);
      return errorResponse('Failed to record production output', 500);
    }
  });
}
