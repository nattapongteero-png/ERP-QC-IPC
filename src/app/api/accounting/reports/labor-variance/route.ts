/**
 * Labor Variance Report API (T146)
 * GET /api/accounting/reports/labor-variance
 */

import { NextRequest, NextResponse } from 'next/server';
import { listVariances } from '@/lib/services/variance-analysis.service';
import { laborVarianceFilterSchema } from '@/lib/validation/variance';
import type { LaborVarianceReport } from '@/types/variance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = laborVarianceFilterSchema.parse({
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      workCenterId: searchParams.get('work_center_id'),
    });

    // Get LRV variances (Labor Rate Variance)
    const { data: lrvData } = await listVariances({
      varianceType: 'lrv',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 1000,
    });

    // Get LEV variances (Labor Efficiency Variance)
    const { data: levData } = await listVariances({
      varianceType: 'lev',
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 1000,
    });

    // Calculate totals
    const totalLrv = lrvData.reduce((sum, v) => sum + Number(v.varianceAmount), 0);
    const totalLev = levData.reduce((sum, v) => sum + Number(v.varianceAmount), 0);

    // Group by work order
    const woMap: Record<number, {
      workOrderId: number;
      workOrderNumber: string;
      itemCode: string;
      lrv: { standard: number; actual: number; variance: number }[];
      lev: { standard: number; actual: number; variance: number }[];
    }> = {};

    for (const v of [...lrvData, ...levData]) {
      if (!woMap[v.workOrderId]) {
        woMap[v.workOrderId] = {
          workOrderId: v.workOrderId,
          workOrderNumber: v.workOrderNumber || '',
          itemCode: v.itemCode || '',
          lrv: [],
          lev: [],
        };
      }

      if (v.varianceType === 'lrv') {
        woMap[v.workOrderId].lrv.push({
          standard: Number(v.standardValue),
          actual: Number(v.actualValue),
          variance: Number(v.varianceAmount),
        });
      } else if (v.varianceType === 'lev') {
        woMap[v.workOrderId].lev.push({
          standard: Number(v.standardValue),
          actual: Number(v.actualValue),
          variance: Number(v.varianceAmount),
        });
      }
    }

    // Build report details
    const details = Object.values(woMap).map((wo) => {
      const lrvSum = wo.lrv.reduce((s, v) => s + v.variance, 0);
      const levSum = wo.lev.reduce((s, v) => s + v.variance, 0);

      // Calculate averages for rates and hours
      const standardHours = wo.lev.length > 0
        ? wo.lev.reduce((s, v) => s + v.standard, 0) / wo.lev.length
        : 0;
      const actualHours = wo.lev.length > 0
        ? wo.lev.reduce((s, v) => s + v.actual, 0) / wo.lev.length
        : 0;
      const standardRate = wo.lrv.length > 0
        ? wo.lrv.reduce((s, v) => s + v.standard, 0) / wo.lrv.length
        : 0;
      const actualRate = wo.lrv.length > 0
        ? wo.lrv.reduce((s, v) => s + v.actual, 0) / wo.lrv.length
        : 0;

      return {
        workOrderId: wo.workOrderId,
        workOrderNumber: wo.workOrderNumber,
        itemCode: wo.itemCode,
        standardHours,
        actualHours,
        standardRate,
        actualRate,
        rateVariance: lrvSum,
        efficiencyVariance: levSum,
      };
    });

    const report: LaborVarianceReport = {
      summary: {
        totalLrv,
        totalLev,
        totalLaborVariance: totalLrv + totalLev,
      },
      details,
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating labor variance report:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
