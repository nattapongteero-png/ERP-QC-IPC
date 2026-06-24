/**
 * Gowning Verification API for Work Orders (eBMR GMP)
 *
 * GET:  the gowning record for a work order (with performer/verifier names)
 * POST: perform gowning checklist with electronic signature
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import {
  performGowning,
  getGowningForWorkOrder,
} from '@/lib/services/wo-gowning.service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/work-orders/[id]/gowning
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const record = await getGowningForWorkOrder(workOrderId);
      return successResponse({ workOrderId, record });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders/[id]/gowning
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const body = await request.json();
      const {
        password,
        gownClean,
        glovesOn,
        maskOn,
        hairnetOn,
        shoeCoverOn,
        handsSanitized,
        notes,
      } = body;

      if (!password) {
        return errorResponse('Password is required for electronic signature');
      }
      if (
        gownClean === undefined ||
        glovesOn === undefined ||
        maskOn === undefined ||
        hairnetOn === undefined ||
        shoeCoverOn === undefined ||
        handsSanitized === undefined
      ) {
        return errorResponse('All checklist items must be provided');
      }

      const result = await performGowning({
        workOrderId,
        userId: session.userId,
        password,
        checklistItems: { gownClean, glovesOn, maskOn, hairnetOn, shoeCoverOn, handsSanitized, notes },
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      });

      if (!result.success) {
        return errorResponse(result.error || 'Failed to perform gowning verification');
      }

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'wo_gowning_records',
        recordId: result.recordId!,
        newValue: {
          workOrderId,
          status: 'performed',
          checklistItems: { gownClean, glovesOn, maskOn, hairnetOn, shoeCoverOn, handsSanitized },
        },
        ipAddress: getClientIP(request),
      });

      return successResponse(
        { recordId: result.recordId, record: result.record },
        'Gowning verification performed successfully. Awaiting verification.'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
