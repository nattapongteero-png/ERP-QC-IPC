/**
 * Line Clearance Verification API
 * Feature: 009-gmp-compliance-gap-analysis Phase 2 (US13 - T070)
 *
 * POST: Verify (approve or reject) a line clearance with electronic signature
 *       Requires dual sign-off (different person from performer)
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
  verifyLineClearance,
  getLineClearanceForWorkOrder,
  getLineClearanceDetails,
} from '@/lib/services/line-clearance.service';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/production/work-orders/[id]/line-clearance/verify
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { password, approved, notes, phase } = body;

      // Validate required fields
      if (!password) {
        return errorResponse('Password is required for electronic signature');
      }

      if (approved === undefined) {
        return errorResponse('Approval decision (approved: true/false) is required');
      }

      // Get existing checklist for this work order + phase. Accept both
      // 'pre-production' (legacy / hyphen) and 'pre_production' canonically.
      const normalizedPhase = typeof phase === 'string' && phase
        ? phase.replace(/-/g, '_')
        : 'production';
      const checklist = await getLineClearanceForWorkOrder(workOrderId, normalizedPhase);

      if (!checklist) {
        return notFoundResponse('No line clearance checklist found for this work order');
      }

      if (checklist.status !== 'performed') {
        return errorResponse(
          `Cannot verify checklist in status: ${checklist.status}. ` +
          `Line clearance must be performed first.`
        );
      }

      // Verify line clearance with e-signature
      const result = await verifyLineClearance({
        checklistId: checklist.id,
        userId: session.userId,
        password,
        approved,
        notes,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      });

      if (!result.success) {
        return errorResponse(result.error || 'Failed to verify line clearance');
      }

      // Get updated checklist details with signatures
      const details = await getLineClearanceDetails(checklist.id);

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: approved ? 'APPROVE' : 'REJECT',
        tableName: 'line_clearance_checklists',
        recordId: checklist.id,
        oldValue: { status: 'performed' },
        newValue: {
          status: approved ? 'verified' : 'rejected',
          approved,
          notes,
        },
        ipAddress: getClientIP(request),
      });

      const message = approved
        ? 'Line clearance verified successfully. Production can now start.'
        : 'Line clearance rejected. A new clearance must be performed.';

      return successResponse(
        {
          checklistId: result.checklistId,
          checklist: result.checklist,
          details,
        },
        message
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
