/**
 * Line Clearance API for Work Orders
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T069)
 *
 * GET: Get line clearance status and checklist for a work order
 * POST: Perform line clearance with electronic signature
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import {
  checkLineClearanceRequired,
  performLineClearance,
  getLineClearanceForWorkOrder,
  getLineClearanceDetails,
} from '@/lib/services/line-clearance.service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/production/work-orders/[id]/line-clearance?phase=X
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const rawPhase = new URL(request.url).searchParams.get('phase') || 'production';
      const phase = rawPhase.replace(/-/g, '_');

      // Get line clearance status for this phase
      const status = await checkLineClearanceRequired(workOrderId, phase);

      // Get checklist details if exists
      let checklistDetails = null;
      if (status.checklist) {
        checklistDetails = await getLineClearanceDetails(status.checklist.id);
      }

      return successResponse({
        workOrderId,
        ...status,
        details: checklistDetails,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders/[id]/line-clearance
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const {
        phase,
        password,
        previousProductCleared,
        areaClean,
        equipmentClean,
        noContaminationRisk,
        labelsRemoved,
        docsReady,
        notes,
      } = body;

      // Validate required fields
      if (!password) {
        return errorResponse('Password is required for electronic signature');
      }

      // Validate all checklist items are provided
      if (
        previousProductCleared === undefined ||
        areaClean === undefined ||
        equipmentClean === undefined ||
        noContaminationRisk === undefined ||
        labelsRemoved === undefined ||
        docsReady === undefined
      ) {
        return errorResponse('All checklist items must be provided');
      }

      // Perform line clearance with e-signature for this phase
      const result = await performLineClearance({
        workOrderId,
        phase: (typeof phase === 'string' && phase ? phase : 'production').replace(/-/g, '_'),
        userId: session.userId,
        password,
        checklistItems: {
          previousProductCleared,
          areaClean,
          equipmentClean,
          noContaminationRisk,
          labelsRemoved,
          docsReady,
          notes,
        },
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      });

      if (!result.success) {
        return errorResponse(result.error || 'Failed to perform line clearance');
      }

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'line_clearance_checklists',
        recordId: result.checklistId!,
        newValue: {
          workOrderId,
          status: 'performed',
          checklistItems: {
            previousProductCleared,
            areaClean,
            equipmentClean,
            noContaminationRisk,
            labelsRemoved,
            docsReady,
          },
        },
        ipAddress: getClientIP(request),
      });

      return successResponse(
        {
          checklistId: result.checklistId,
          checklist: result.checklist,
        },
        'Line clearance performed successfully. Awaiting verification.'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
