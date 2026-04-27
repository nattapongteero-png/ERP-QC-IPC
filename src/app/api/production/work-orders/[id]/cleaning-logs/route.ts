import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOCleaningLogs,
  getCleaningRequirements,
  createWOCleaningLog,
  verifyWOCleaningLog,
  getWOCleaningStatus,
} from '@/lib/services/wo-execution.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

// Valid phases for cleaning
const VALID_PHASES = ['pre_production', 'post_production', 'pre_packaging'];

// Valid item types
const VALID_ITEM_TYPES = ['room', 'equipment'];

// GET /api/production/work-orders/[id]/cleaning-logs - Get cleaning logs
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

      const { searchParams } = new URL(request.url);
      const phase = searchParams.get('phase') || undefined;
      const includeStatus = searchParams.get('includeStatus') === 'true';

      if (phase && !VALID_PHASES.includes(phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      // When phase is specified, return BOM-merged requirements (rooms + equipment + logs)
      if (phase) {
        const requirements = await getCleaningRequirements(workOrderId, phase);

        if (includeStatus) {
          const status = await getWOCleaningStatus(workOrderId, phase);
          return successResponse({ requirements, status });
        }

        return successResponse(requirements);
      }

      // Without phase, return raw logs (for status/summary endpoints)
      const logs = await getWOCleaningLogs(workOrderId);
      return successResponse(logs);
    } catch (error) {
      console.error('Error fetching WO cleaning logs:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/cleaning-logs - Create cleaning log
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
      if (!data.phase || !data.itemType || data.isClean === undefined) {
        return errorResponse('Missing required fields: phase, itemType, isClean');
      }

      if (!VALID_PHASES.includes(data.phase)) {
        return errorResponse(`Invalid phase. Must be one of: ${VALID_PHASES.join(', ')}`);
      }

      if (!VALID_ITEM_TYPES.includes(data.itemType)) {
        return errorResponse(`Invalid itemType. Must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
      }

      // Validate that either roomId or equipmentId is provided based on itemType
      if (data.itemType === 'room' && !data.roomId) {
        return errorResponse('roomId is required when itemType is "room"');
      }
      if (data.itemType === 'equipment' && !data.equipmentId) {
        return errorResponse('equipmentId is required when itemType is "equipment"');
      }

      // Use session user as operator if not specified
      const operatorId = data.operatorId || session.userId;

      const log = await createWOCleaningLog({
        workOrderId,
        phase: data.phase,
        itemType: data.itemType,
        roomId: data.roomId,
        equipmentId: data.equipmentId,
        isClean: data.isClean,
        operatorId,
        performedAt: data.performedAt || new Date().toISOString(),
        notes: data.notes,
      });

      publishWorkOrderChanged(workOrderId, 'cleaning', session.userId, data.phase);

      return successResponse(log, 'Cleaning log recorded');
    } catch (error) {
      console.error('Error creating WO cleaning log:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/work-orders/[id]/cleaning-logs - Verify cleaning log
export async function PATCH(
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

      if (!data.logId) {
        return errorResponse('Missing logId');
      }

      // Support pass/fail verify result
      const verifyResult = data.verifyResult || 'pass';
      if (!['pass', 'fail'].includes(verifyResult)) {
        return errorResponse('verifyResult must be "pass" or "fail"');
      }

      // Use session user as verifier if not specified
      const verifierId = data.verifierId || session.userId;

      const log = await verifyWOCleaningLog(data.logId, verifierId, verifyResult);
      publishWorkOrderChanged(workOrderId, 'cleaning', session.userId);
      const msg = verifyResult === 'pass' ? 'Cleaning verified — Pass' : 'Cleaning verified — Fail (requires re-cleaning)';
      return successResponse(log, msg);
    } catch (error) {
      console.error('Error verifying WO cleaning log:', error);
      // Surface known business-logic errors (e.g. dual-control violation)
      // directly to the caller instead of hiding them as "Internal server error".
      if (error instanceof Error && error.message) {
        return errorResponse(error.message);
      }
      return serverErrorResponse(error);
    }
  });
}
