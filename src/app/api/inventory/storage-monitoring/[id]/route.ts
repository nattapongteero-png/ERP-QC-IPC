/**
 * Storage Area Environmental Monitoring — single-record update / delete
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
  updateStorageEnvLog,
  deleteStorageEnvLog,
} from '@/lib/services/storage-monitoring.service';

// PUT /api/inventory/storage-monitoring/[id]
// Body: { warehouseId?, locationId?, readingAt?, temperature?, humidity?, notes? }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const logId = Number(id);
      if (!logId) return errorResponse('Invalid id');

      const data = await request.json();
      if (data.temperature == null && data.humidity == null) {
        return errorResponse('Provide at least one of temperature or humidity');
      }

      const log = await updateStorageEnvLog(logId, {
        warehouseId: data.warehouseId != null ? Number(data.warehouseId) : undefined,
        locationId:
          data.locationId !== undefined
            ? data.locationId
              ? Number(data.locationId)
              : null
            : undefined,
        readingAt: data.readingAt || undefined,
        temperature:
          data.temperature !== undefined
            ? data.temperature != null
              ? Number(data.temperature)
              : null
            : undefined,
        humidity:
          data.humidity !== undefined
            ? data.humidity != null
              ? Number(data.humidity)
              : null
            : undefined,
        notes: data.notes !== undefined ? data.notes || null : undefined,
      });

      const msg =
        log.alertLevel === 'in_spec'
          ? 'Reading updated — in spec'
          : `⚠ ALERT (${log.alertLevel}): ${log.alertMessage}`;
      return successResponse(log, msg);
    } catch (error) {
      console.error('Storage monitoring PUT error:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/inventory/storage-monitoring/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const logId = Number(id);
      if (!logId) return errorResponse('Invalid id');

      await deleteStorageEnvLog(logId);
      return successResponse({ id: logId }, 'Reading deleted');
    } catch (error) {
      console.error('Storage monitoring DELETE error:', error);
      return serverErrorResponse(error);
    }
  });
}
