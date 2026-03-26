import { NextRequest } from 'next/server';
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
      return successResponse(materials);
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
      });

      return successResponse(material, 'Material weight recorded');
    } catch (error) {
      console.error('Error recording material weight:', error);
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
      return successResponse(material, 'Material weight verified');
    } catch (error) {
      console.error('Error verifying material weight:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found') ||
            error.message.includes('not been weighed') ||
            error.message.includes('not issued from inventory')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
  });
}
