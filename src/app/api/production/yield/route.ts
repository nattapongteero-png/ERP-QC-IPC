import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { calculateYield, recordProductionOutput, recordBulkOutput } from '@/lib/services/production.service';
import { getProductionYieldReport } from '@/lib/services/reports.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

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

// POST - Record production output (bulk or finished based on ?stage=)
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const {
        workOrderId,
        actualQuantity,
        rejectQuantity,
        warehouseId,
        stage,
        // Audit #24-#28 — MFD/EXP must be captured at production output.
        // Optional in request because the service falls back to WO actualStartDate;
        // operator can override both via the form.
        manufacturingDate,
        expiryDate,
      } = body;
      const outputStage = (stage === 'bulk' ? 'bulk' : 'finished') as 'bulk' | 'finished';

      if (!workOrderId || actualQuantity === undefined) {
        return errorResponse('workOrderId and actualQuantity are required', 400);
      }

      if (outputStage === 'bulk') {
        await recordBulkOutput(workOrderId, actualQuantity, user.userId);
        // Notify dashboards / sub-pages on the same WO so they refresh
        // without manual reload (multi-user / multi-device).
        try { publishWorkOrderChanged(workOrderId, 'production-output', user.userId, 'bulk'); } catch {}
        return successResponse({
          stage: 'bulk',
          bulkQuantity: actualQuantity,
          message: 'Bulk product yield recorded successfully',
        });
      }

      if (!warehouseId) {
        return errorResponse('warehouseId is required for finished output stage', 400);
      }

      const lotId = await recordProductionOutput(
        workOrderId,
        actualQuantity,
        rejectQuantity || 0,
        warehouseId,
        user.userId,
        manufacturingDate ?? null,
        expiryDate ?? null
      );

      const yieldResult = await calculateYield(workOrderId);

      try { publishWorkOrderChanged(workOrderId, 'production-output', user.userId, 'finished'); } catch {}

      return successResponse({
        stage: 'finished',
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
