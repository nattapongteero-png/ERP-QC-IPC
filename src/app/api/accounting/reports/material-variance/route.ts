/**
 * Material Variance Report API (T145)
 * GET /api/accounting/reports/material-variance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { listVariances } from '@/lib/services/variance-analysis.service';
import { materialVarianceFilterSchema } from '@/lib/validation/variance';
import type { MaterialVarianceReport } from '@/types/variance';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const filters = materialVarianceFilterSchema.parse({
        dateFrom: searchParams.get('date_from'),
        dateTo: searchParams.get('date_to'),
        itemId: searchParams.get('item_id'),
      });

      // Get MPV variances
      const { data: mpvData } = await listVariances({
        varianceType: 'mpv',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        itemId: filters.itemId,
        limit: 1000,
      });

      // Get MUV variances
      const { data: muvData } = await listVariances({
        varianceType: 'muv',
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        itemId: filters.itemId,
        limit: 1000,
      });

      // Calculate totals
      const totalMpv = mpvData.reduce((sum, v) => sum + Number(v.varianceAmount), 0);
      const totalMuv = muvData.reduce((sum, v) => sum + Number(v.varianceAmount), 0);

      // Group by item
      const itemMap: Record<number, {
        itemId: number;
        itemCode: string;
        itemName: string;
        mpv: { standard: number; actual: number; variance: number }[];
        muv: { standard: number; actual: number; variance: number; qty: number }[];
      }> = {};

      for (const v of [...mpvData, ...muvData]) {
        if (!itemMap[v.itemId]) {
          itemMap[v.itemId] = {
            itemId: v.itemId,
            itemCode: v.itemCode || '',
            itemName: v.itemName || '',
            mpv: [],
            muv: [],
          };
        }

        if (v.varianceType === 'mpv') {
          itemMap[v.itemId].mpv.push({
            standard: Number(v.standardValue),
            actual: Number(v.actualValue),
            variance: Number(v.varianceAmount),
          });
        } else if (v.varianceType === 'muv') {
          itemMap[v.itemId].muv.push({
            standard: Number(v.standardValue),
            actual: Number(v.actualValue),
            variance: Number(v.varianceAmount),
            qty: Number(v.quantity),
          });
        }
      }

      // Build report items
      const items = Object.values(itemMap).map((item) => {
        const mpvSum = item.mpv.reduce((s, v) => s + v.variance, 0);
        const muvSum = item.muv.reduce((s, v) => s + v.variance, 0);
        const avgStandardPrice = item.mpv.length > 0
          ? item.mpv.reduce((s, v) => s + v.standard, 0) / item.mpv.length
          : 0;
        const avgActualPrice = item.mpv.length > 0
          ? item.mpv.reduce((s, v) => s + v.actual, 0) / item.mpv.length
          : 0;
        const totalStandardQty = item.muv.reduce((s, v) => s + v.standard, 0);
        const totalActualQty = item.muv.reduce((s, v) => s + v.actual, 0);

        return {
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          standardPrice: avgStandardPrice,
          actualPrice: avgActualPrice,
          priceVariance: mpvSum,
          standardQty: totalStandardQty,
          actualQty: totalActualQty,
          usageVariance: muvSum,
          totalVariance: mpvSum + muvSum,
        };
      });

      const report: MaterialVarianceReport = {
        summary: {
          totalMpv,
          totalMuv,
          totalMaterialVariance: totalMpv + totalMuv,
        },
        items,
      };

      return NextResponse.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating material variance report:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
