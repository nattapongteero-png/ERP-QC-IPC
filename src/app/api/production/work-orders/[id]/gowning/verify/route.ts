/**
 * Gowning Verification — verify (approve/reject) with electronic signature.
 * Requires dual sign-off (a different person from the performer).
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
  verifyGowning,
  getGowningForWorkOrder,
  getGowningDetails,
} from '@/lib/services/wo-gowning.service';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/production/work-orders/[id]/gowning/verify
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      if (isNaN(workOrderId)) return errorResponse('Invalid work order ID');

      const body = await request.json();
      const { password, approved, notes } = body;

      if (!password) return errorResponse('Password is required for electronic signature');
      if (approved === undefined) {
        return errorResponse('Approval decision (approved: true/false) is required');
      }

      const record = await getGowningForWorkOrder(workOrderId);
      if (!record) {
        return notFoundResponse('No gowning record found for this work order');
      }
      if (record.status !== 'performed') {
        return errorResponse(
          `Cannot verify gowning in status: ${record.status}. Gowning must be performed first.`
        );
      }

      const result = await verifyGowning({
        recordId: record.id,
        userId: session.userId,
        password,
        approved,
        notes,
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined,
      });

      if (!result.success) {
        return errorResponse(result.error || 'Failed to verify gowning');
      }

      const details = await getGowningDetails(record.id);

      await createAuditLog({
        userId: session.userId,
        action: approved ? 'APPROVE' : 'REJECT',
        tableName: 'wo_gowning_records',
        recordId: record.id,
        oldValue: { status: 'performed' },
        newValue: { status: approved ? 'verified' : 'rejected', approved, notes },
        ipAddress: getClientIP(request),
      });

      const message = approved
        ? 'Gowning verified successfully.'
        : 'Gowning rejected. A new gowning record must be performed.';

      return successResponse(
        { recordId: result.recordId, record: result.record, details },
        message
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
