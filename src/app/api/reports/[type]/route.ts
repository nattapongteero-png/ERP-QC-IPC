import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import {
  getInventoryValuationReport,
  getExpiryReport,
  getProductionYieldReport,
  getTraceabilityReport,
  getQualitySummaryReport,
  getStockMovementReport,
  getVendorPerformanceReport,
} from '@/lib/services/reports.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { type } = await params;
      const { searchParams } = new URL(request.url);
      const dateFrom = searchParams.get('dateFrom') || undefined;
      const dateTo = searchParams.get('dateTo') || undefined;

      let report;

      switch (type) {
        case 'inventory-valuation':
          report = await getInventoryValuationReport();
          break;

        case 'expiry':
          const daysThreshold = parseInt(searchParams.get('days') || '90');
          report = await getExpiryReport(daysThreshold);
          break;

        case 'production-yield':
          report = await getProductionYieldReport(dateFrom, dateTo);
          break;

        case 'traceability':
          const lotId = parseInt(searchParams.get('lotId') || '0');
          const direction = (searchParams.get('direction') || 'both') as 'forward' | 'backward' | 'both';
          if (!lotId) {
            return errorResponse('lotId is required for traceability report', 400);
          }
          report = await getTraceabilityReport(lotId, direction);
          break;

        case 'quality-summary':
          report = await getQualitySummaryReport(dateFrom, dateTo);
          break;

        case 'stock-movement':
          const itemId = searchParams.get('itemId') ? parseInt(searchParams.get('itemId')!) : undefined;
          report = await getStockMovementReport(itemId, dateFrom, dateTo);
          break;

        case 'vendor-performance':
          report = await getVendorPerformanceReport();
          break;

        default:
          return errorResponse(`Unknown report type: ${type}`, 400);
      }

      return successResponse({
        reportType: type,
        generatedAt: new Date().toISOString(),
        parameters: { dateFrom, dateTo },
        data: report,
      });
    } catch (error) {
      console.error('Report generation error:', error);
      return errorResponse('Failed to generate report', 500);
    }
  });
}
