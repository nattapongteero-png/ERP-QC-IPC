import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOPackagingIntegrityLogs,
  createWOPackagingIntegrityLog,
} from '@/lib/services/wo-execution.service';

// GET /api/production/work-orders/[id]/packaging-integrity - Get packaging integrity logs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const logs = await getWOPackagingIntegrityLogs(workOrderId);
      return successResponse(logs);
    } catch (error) {
      console.error('Error fetching WO packaging integrity logs:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/packaging-integrity - Create packaging integrity log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const data = await request.json();

      // Validate required fields
      if (
        !data.checkTime ||
        data.tubeCapComplete === undefined ||
        data.lotNumberCorrect === undefined ||
        data.packingCorrect === undefined
      ) {
        return errorResponse(
          'Missing required fields: checkTime, tubeCapComplete, lotNumberCorrect, packingCorrect'
        );
      }

      // Use session user as operator/inspector if not specified
      const operatorId = data.operatorId || session.userId;
      const inspectorId = data.inspectorId || session.userId;

      const log = await createWOPackagingIntegrityLog({
        workOrderId,
        checkTime: data.checkTime,
        tubeCapComplete: data.tubeCapComplete,
        lotNumberCorrect: data.lotNumberCorrect,
        packingCorrect: data.packingCorrect,
        operatorId,
        inspectorId,
        notes: data.notes,
      });

      const allPass = log.tubeCapComplete && log.lotNumberCorrect && log.packingCorrect;
      return successResponse(
        log,
        allPass ? 'Packaging integrity check passed' : 'Packaging integrity check has failures'
      );
    } catch (error) {
      console.error('Error creating WO packaging integrity log:', error);
      return serverErrorResponse(error);
    }
  });
}
