import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { getTraceabilityReport } from '@/lib/services/reports.service';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';

// GET - Get traceability for a lot
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      let lotId = parseInt(searchParams.get('lotId') || '0');
      const lotNumber = searchParams.get('lotNumber');
      const direction = searchParams.get('direction') as 'forward' | 'backward' | 'both' || 'both';

      // If lotNumber is provided but not lotId, look up the lot by number
      if (!lotId && lotNumber) {
        const lots = getTableRef('inventoryLots');
        const result = await executeDbOperation(async (db) => {
          return db
            .select({ id: lots.id })
            .from(lots)
            .where(eq(lots.lotNumber, lotNumber))
            .limit(1);
        });

        if (result.length > 0) {
          lotId = result[0].id;
        }
      }

      if (!lotId) {
        return errorResponse('lotId or lotNumber is required', 400);
      }

      const report = await getTraceabilityReport(lotId, direction);

      return successResponse(report);
    } catch (error) {
      console.error('Traceability error:', error);
      return errorResponse('Failed to generate traceability report', 500);
    }
  });
}
