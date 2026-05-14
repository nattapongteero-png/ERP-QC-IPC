import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOPackagingMaterials,
  createWOPackagingMaterial,
  updateWOPackagingMaterial,
  verifyWOPackagingMaterial,
} from '@/lib/services/wo-execution.service';
import { publishWorkOrderChanged } from '@/lib/realtime';

// GET /api/production/work-orders/[id]/packaging-materials - Get packaging materials
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

      const materials = await getWOPackagingMaterials(workOrderId);
      return successResponse(materials);
    } catch (error) {
      console.error('Error fetching WO packaging materials:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/packaging-materials - Add packaging material
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
      if (!data.materialName || data.qtyRequisitioned === undefined || !data.unit) {
        return errorResponse('Missing required fields: materialName, qtyRequisitioned, unit');
      }

      // Use session user as operator if not specified
      const operatorId = data.operatorId || session.userId;

      const material = await createWOPackagingMaterial({
        workOrderId,
        itemId: data.itemId,
        materialName: data.materialName,
        qtyRequisitioned: data.qtyRequisitioned,
        unit: data.unit,
        operatorId,
      });

      publishWorkOrderChanged(workOrderId, 'packaging-materials', session.userId, 'add');
      return successResponse(material, 'Packaging material added');
    } catch (error) {
      console.error('Error creating WO packaging material:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/work-orders/[id]/packaging-materials - Update used/returned quantities
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

      if (!data.materialId) {
        return errorResponse('Missing materialId');
      }

      if (data.qtyUsed === undefined && data.qtyReturned === undefined) {
        return errorResponse('Must provide at least one of: qtyUsed, qtyReturned');
      }

      const material = await updateWOPackagingMaterial(
        data.materialId,
        data.qtyUsed,
        data.qtyReturned
      );

      publishWorkOrderChanged(workOrderId, 'packaging-materials', session.userId, 'update');
      return successResponse(material, 'Packaging material updated');
    } catch (error) {
      console.error('Error updating WO packaging material:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/work-orders/[id]/packaging-materials - Verify packaging material
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

      const material = await verifyWOPackagingMaterial(data.materialId, verifierId);
      publishWorkOrderChanged(workOrderId, 'packaging-materials', session.userId, 'verify');
      return successResponse(material, 'Packaging material verified');
    } catch (error) {
      console.error('Error verifying WO packaging material:', error);
      if (error instanceof Error) {
        const msg = error.message;
        const isDualControlViolation =
          msg.includes('ตรวจสอบรายการของตนเอง') ||
          msg.includes('ผู้ปฏิบัติและผู้ตรวจสอบ') ||
          msg.toLowerCase().includes('dual control') ||
          msg.toLowerCase().includes('cannot verify own');
        const isKnownBusinessError =
          isDualControlViolation ||
          msg.includes('not found') ||
          msg.includes('not been');

        if (isKnownBusinessError) {
          return errorResponse(msg, isDualControlViolation ? 422 : 400);
        }
      }
      return serverErrorResponse(error);
    }
  });
}
