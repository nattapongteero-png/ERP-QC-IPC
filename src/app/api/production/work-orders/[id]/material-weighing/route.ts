import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOMaterials,
  recordMaterialWeight,
  verifyMaterialWeight,
} from '@/lib/services/wo-execution.service';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { publishWorkOrderChanged } from '@/lib/realtime';

// GET /api/production/work-orders/[id]/material-weighing - Get materials with weighing status
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

      const materials = await getWOMaterials(workOrderId);

      // Fetch requisition status from work order
      const workOrders = getTableRef('workOrders');
      const woReqResult = await executeDbOperation(async (db) =>
        db.select({ requisitionStatus: workOrders.requisitionStatus })
          .from(workOrders)
          .where(eq(workOrders.id, parseInt(id)))
      );
      const requisitionStatus = (woReqResult[0] as Record<string, unknown>)?.requisitionStatus || 'none';

      return successResponse({ materials, requisitionStatus });
    } catch (error) {
      console.error('Error fetching WO materials:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/work-orders/[id]/material-weighing - Record material weight
export async function PUT(
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
      if (!data.materialId || data.weighedQty === undefined) {
        return errorResponse('Missing required fields: materialId, weighedQty');
      }

      // Use session user as operator if not specified
      const weighedBy = data.weighedBy || session.userId;

      const material = await recordMaterialWeight({
        materialId: data.materialId,
        weighedQty: data.weighedQty,
        weighedBy,
        lotId: data.lotId || undefined,
        waterDate: data.waterDate,
        waterConductivity: data.waterConductivity,
        waterTemperature: data.waterTemperature,
        scaleId: data.scaleId ? Number(data.scaleId) : undefined,
        requireScaleVerification: data.requireScaleVerification,
      });

      publishWorkOrderChanged(workOrderId, 'material-weighing', session.userId);

      return successResponse(material, 'Material weight recorded');
    } catch (error) {
      console.error('Error recording material weight:', error);
      // Feature 021 — scale verification errors map to 409
      const { ScaleVerificationError } = await import('@/types/scale-verification');
      if (error instanceof ScaleVerificationError) {
        return NextResponse.json(
          { error: error.message, code: error.code, details: error.details },
          { status: 409 },
        );
      }
      if (error instanceof Error) {
        if (error.message.includes('lot not found') ||
            error.message.includes('not in released status') ||
            error.message.includes('Insufficient quantity')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/work-orders/[id]/material-weighing - Verify material weight
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

      if (!data.materialId) {
        return errorResponse('Missing materialId');
      }

      // Use session user as verifier if not specified
      const verifierId = data.verifierId || session.userId;

      const material = await verifyMaterialWeight(data.materialId, verifierId);
      publishWorkOrderChanged(workOrderId, 'material-weighing', session.userId);
      return successResponse(material, 'Material weight verified');
    } catch (error) {
      console.error('Error verifying material weight:', error);
      if (error instanceof Error) {
        // Detect business-rule errors thrown intentionally by the service.
        // These are expected outcomes (dual control violation, not-yet-weighed,
        // out-of-stock, etc.) — surface them to the client as 422 with the
        // full message so the UI can show a proper toast. Only unmatched
        // errors fall through to 500 Internal Server Error.
        const msg = error.message;
        const isDualControlViolation =
          msg.includes('ตรวจสอบรายการของตนเอง') ||
          msg.includes('ผู้ปฏิบัติและผู้ตรวจสอบ') ||
          msg.toLowerCase().includes('dual control') ||
          msg.toLowerCase().includes('cannot verify own');
        const isKnownBusinessError =
          isDualControlViolation ||
          msg.includes('not found') ||
          msg.includes('not been weighed') ||
          msg.includes('Cannot verify') ||
          msg.includes('Insufficient quantity') ||
          msg.includes('no available inventory') ||
          msg.includes('inventory issue failed');

        if (isKnownBusinessError) {
          // 422 Unprocessable Entity — server understood the request but
          // the business rule forbids completing it. Dual-control gets its
          // own status code context so frontend can style differently.
          return errorResponse(msg, isDualControlViolation ? 422 : 400);
        }
      }
      return serverErrorResponse(error);
    }
  });
}
