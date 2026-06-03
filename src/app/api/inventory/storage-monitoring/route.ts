/**
 * Storage Area Environmental Monitoring API
 * Audit Q6
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  createStorageEnvLog,
  listStorageEnvLogs,
  getOpenAlertsSummary,
} from '@/lib/services/storage-monitoring.service';

// GET /api/inventory/storage-monitoring
//   ?warehouseId=&locationId=&dateFrom=&dateTo=&unacknowledgedOnly=true&alertsOnly=true&summary=true&limit=200
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      if (searchParams.get('summary') === 'true') {
        const data = await getOpenAlertsSummary();
        return successResponse(data);
      }

      const filter = {
        warehouseId: searchParams.get('warehouseId') ? Number(searchParams.get('warehouseId')) : undefined,
        locationId: searchParams.get('locationId') ? Number(searchParams.get('locationId')) : undefined,
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        unacknowledgedOnly: searchParams.get('unacknowledgedOnly') === 'true',
        alertsOnly: searchParams.get('alertsOnly') === 'true',
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 200,
      };
      const data = await listStorageEnvLogs(filter);
      return successResponse(data);
    } catch (error) {
      console.error('Storage monitoring GET error:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/inventory/storage-monitoring
// Body: { warehouseId, locationId?, readingAt?, temperature?, humidity?, notes? }
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const data = await request.json();
      if (!data?.warehouseId) {
        return errorResponse('warehouseId is required');
      }
      if (data.temperature == null && data.humidity == null) {
        return errorResponse('Provide at least one of temperature or humidity');
      }

      const log = await createStorageEnvLog({
        warehouseId: Number(data.warehouseId),
        locationId: data.locationId ? Number(data.locationId) : null,
        readingAt: data.readingAt || undefined,
        temperature: data.temperature != null ? Number(data.temperature) : null,
        humidity: data.humidity != null ? Number(data.humidity) : null,
        recordedBy: session.userId,
        notes: data.notes || null,
      });

      const msg = log.alertLevel === 'in_spec'
        ? 'Reading recorded — in spec'
        : `⚠ ALERT (${log.alertLevel}): ${log.alertMessage}`;
      return successResponse(log, msg);
    } catch (error) {
      console.error('Storage monitoring POST error:', error);
      return serverErrorResponse(error);
    }
  });
}
