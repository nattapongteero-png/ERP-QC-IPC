/**
 * Acknowledge a storage environmental alert.
 * Audit Q6
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { acknowledgeAlert } from '@/lib/services/storage-monitoring.service';

// POST /api/inventory/storage-monitoring/acknowledge
// Body: { logId: number, notes?: string }
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const data = await request.json();
      const logId = Number(data?.logId);
      if (!logId) return errorResponse('logId is required');

      try {
        const log = await acknowledgeAlert(logId, session.userId, data.notes);
        return successResponse(log, 'Alert acknowledged');
      } catch (innerError) {
        if (innerError instanceof Error && innerError.message.startsWith('NO_ALERT')) {
          return errorResponse(innerError.message, 400);
        }
        throw innerError;
      }
    } catch (error) {
      console.error('Acknowledge alert error:', error);
      return serverErrorResponse(error);
    }
  });
}
