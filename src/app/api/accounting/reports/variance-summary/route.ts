/**
 * Variance Summary Report API (T144)
 * GET /api/accounting/reports/variance-summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { listVariances } from '@/lib/services/variance-analysis.service';
import { varianceSummaryFilterSchema } from '@/lib/validation/variance';
import type { VarianceType, VarianceSummaryReport, VarianceSummaryRow } from '@/types/variance';

const VARIANCE_LABELS: Record<VarianceType, string> = {
  mpv: 'Material Price Variance',
  muv: 'Material Usage Variance',
  lrv: 'Labor Rate Variance',
  lev: 'Labor Efficiency Variance',
  voh_var: 'Variable Overhead Variance',
  foh_vol: 'Fixed Overhead Volume Variance',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = varianceSummaryFilterSchema.parse({
      periodId: searchParams.get('period_id'),
      dateFrom: searchParams.get('date_from'),
      dateTo: searchParams.get('date_to'),
      groupBy: searchParams.get('group_by'),
    });

    // Get all variances for the period
    const { data: variances, summary } = await listVariances({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      limit: 1000,
    });

    // Build by-type summary
    const byType: VarianceSummaryReport['byType'] = [
      { varianceType: 'mpv', varianceTypeName: VARIANCE_LABELS.mpv, amount: summary.mpvTotal, isFavorable: summary.mpvTotal <= 0 },
      { varianceType: 'muv', varianceTypeName: VARIANCE_LABELS.muv, amount: summary.muvTotal, isFavorable: summary.muvTotal <= 0 },
      { varianceType: 'lrv', varianceTypeName: VARIANCE_LABELS.lrv, amount: summary.lrvTotal, isFavorable: summary.lrvTotal <= 0 },
      { varianceType: 'lev', varianceTypeName: VARIANCE_LABELS.lev, amount: summary.levTotal, isFavorable: summary.levTotal <= 0 },
      { varianceType: 'voh_var', varianceTypeName: VARIANCE_LABELS.voh_var, amount: summary.vohVarTotal, isFavorable: summary.vohVarTotal <= 0 },
      { varianceType: 'foh_vol', varianceTypeName: VARIANCE_LABELS.foh_vol, amount: summary.fohVolTotal, isFavorable: summary.fohVolTotal <= 0 },
    ];

    // Group details based on groupBy parameter
    const groupedDetails: Record<string, VarianceSummaryRow> = {};
    for (const v of variances) {
      let groupKey: string;
      let groupName: string;

      switch (filters.groupBy) {
        case 'item':
          groupKey = String(v.itemId);
          groupName = v.itemCode || `Item ${v.itemId}`;
          break;
        case 'work_order':
          groupKey = String(v.workOrderId);
          groupName = v.workOrderNumber || `WO ${v.workOrderId}`;
          break;
        case 'month':
          groupKey = v.varianceDate?.substring(0, 7) || 'unknown';
          groupName = groupKey;
          break;
        case 'variance_type':
        default:
          groupKey = v.varianceType;
          groupName = VARIANCE_LABELS[v.varianceType as VarianceType];
          break;
      }

      if (!groupedDetails[groupKey]) {
        groupedDetails[groupKey] = {
          groupKey,
          groupName,
          mpv: 0, muv: 0, lrv: 0, lev: 0, vohVar: 0, fohVol: 0, total: 0, isFavorable: true,
        };
      }

      const row = groupedDetails[groupKey];
      const amount = Number(v.varianceAmount);
      row.total += amount;

      switch (v.varianceType) {
        case 'mpv': row.mpv += amount; break;
        case 'muv': row.muv += amount; break;
        case 'lrv': row.lrv += amount; break;
        case 'lev': row.lev += amount; break;
        case 'voh_var': row.vohVar += amount; break;
        case 'foh_vol': row.fohVol += amount; break;
      }
    }

    // Calculate isFavorable for each row
    const details = Object.values(groupedDetails).map((row) => ({
      ...row,
      isFavorable: row.total <= 0,
    }));

    const report: VarianceSummaryReport = {
      period: filters.dateFrom && filters.dateTo
        ? `${filters.dateFrom} to ${filters.dateTo}`
        : 'All Time',
      totalVariances: summary.totalVariance,
      favorableVariances: summary.favorableTotal,
      unfavorableVariances: summary.unfavorableTotal,
      byType,
      details,
    };

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Error generating variance summary:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
