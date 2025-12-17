import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { checkExpiryAlerts } from '@/lib/services/inventory.service';
import { getExpiryReport } from '@/lib/services/reports.service';

// GET - Get expiry alerts
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const daysThreshold = parseInt(searchParams.get('days') || '30');

      const alerts = await checkExpiryAlerts(daysThreshold);
      const report = await getExpiryReport(daysThreshold);

      return successResponse({
        alerts,
        report,
      });
    } catch (error) {
      console.error('Expiry alerts error:', error);
      return errorResponse('Failed to get expiry alerts', 500);
    }
  });
}
