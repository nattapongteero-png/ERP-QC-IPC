import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { traceForward, traceBackward } from '@/lib/services/inventory.service';
import { getTraceabilityReport } from '@/lib/services/reports.service';

// GET - Get traceability for a lot
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const lotId = parseInt(searchParams.get('lotId') || '0');
      const direction = searchParams.get('direction') as 'forward' | 'backward' | 'both' || 'both';

      if (!lotId) {
        return errorResponse('lotId is required', 400);
      }

      const report = await getTraceabilityReport(lotId, direction);

      return successResponse(report);
    } catch (error) {
      console.error('Traceability error:', error);
      return errorResponse('Failed to generate traceability report', 500);
    }
  });
}
