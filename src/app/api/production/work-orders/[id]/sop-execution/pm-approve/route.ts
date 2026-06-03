/**
 * Production Manager approval for critical SOP execution steps.
 * Audit #16 — Triple Independence: Operator ≠ Verifier ≠ PM
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { pmApproveWOSOPStep } from '@/lib/services/wo-execution.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

// POST /api/production/work-orders/[id]/sop-execution/pm-approve
// Body: { executionId: number }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);
      if (Number.isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const data = await request.json();
      const executionId = Number(data?.executionId);
      if (!executionId) {
        return errorResponse('Missing required field: executionId');
      }

      try {
        const result = await pmApproveWOSOPStep(executionId, session.userId);
        publishWorkOrderChanged(workOrderId, 'sop-execution', session.userId, 'pm-approve');
        return successResponse(result, 'Production Manager approved this step');
      } catch (innerError) {
        if (innerError instanceof Error) {
          const code = innerError.message.split(':')[0];
          const map: Record<string, [string, number]> = {
            STEP_NOT_VERIFIED: ['ขั้นตอนนี้ยังไม่ได้รับการ verify — ต้อง verify ก่อนถึงจะ approve ได้', 409],
            STEP_NOT_CRITICAL: ['ขั้นตอนนี้ไม่ใช่ critical — ไม่ต้อง PM approval', 400],
            PM_SAME_AS_OPERATOR: ['Production Manager ต้องเป็นคนละคนกับผู้ปฏิบัติ (operator)', 409],
            PM_SAME_AS_VERIFIER: ['Production Manager ต้องเป็นคนละคนกับ verifier', 409],
          };
          const mapped = map[code];
          if (mapped) return errorResponse(mapped[0], mapped[1]);
        }
        throw innerError;
      }
    } catch (error) {
      console.error('Error in PM approval:', error);
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
