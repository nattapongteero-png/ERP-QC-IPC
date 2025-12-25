import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWOFinishedInspection,
  createWOFinishedInspection,
  updateWOFinishedInspection,
  reInspectWOFinishedInspection,
} from '@/lib/services/wo-execution.service';

// GET /api/production/work-orders/[id]/finished-inspection - Get finished product inspection
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

      const inspection = await getWOFinishedInspection(workOrderId);
      return successResponse(inspection);
    } catch (error) {
      console.error('Error fetching WO finished inspection:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/work-orders/[id]/finished-inspection - Create finished product inspection
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

      // Check if inspection already exists
      const existing = await getWOFinishedInspection(workOrderId);
      if (existing) {
        return errorResponse('Finished inspection already exists for this work order');
      }

      const data = await request.json();

      // Validate required fields
      if (!data.sampleDate || !data.checklistResults) {
        return errorResponse('Missing required fields: sampleDate, checklistResults');
      }

      // Validate checklistResults is valid JSON
      try {
        if (typeof data.checklistResults === 'string') {
          JSON.parse(data.checklistResults);
        }
      } catch {
        return errorResponse('Invalid checklistResults JSON format');
      }

      // Use session user as sampler if not specified
      const samplerId = data.samplerId || session.userId;

      const checklistResultsStr =
        typeof data.checklistResults === 'object'
          ? JSON.stringify(data.checklistResults)
          : data.checklistResults;

      const inspection = await createWOFinishedInspection({
        workOrderId,
        sampleDate: data.sampleDate,
        samplerId,
        sampleQtyForTest: data.sampleQtyForTest,
        sampleQtyForRetention: data.sampleQtyForRetention,
        checklistResults: checklistResultsStr,
      });

      return successResponse(inspection, 'Finished product inspection created');
    } catch (error) {
      console.error('Error creating WO finished inspection:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/work-orders/[id]/finished-inspection - Update inspection checklist and status
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
      if (!data.inspectionId || !data.checklistResults || !data.status) {
        return errorResponse('Missing required fields: inspectionId, checklistResults, status');
      }

      const validStatuses = ['pending', 'pass', 'fail'];
      if (!validStatuses.includes(data.status)) {
        return errorResponse(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      // Validate checklistResults is valid JSON
      try {
        if (typeof data.checklistResults === 'string') {
          JSON.parse(data.checklistResults);
        }
      } catch {
        return errorResponse('Invalid checklistResults JSON format');
      }

      // Use session user as inspector if not specified
      const inspectorId = data.inspectorId || session.userId;

      const checklistResultsStr =
        typeof data.checklistResults === 'object'
          ? JSON.stringify(data.checklistResults)
          : data.checklistResults;

      const inspection = await updateWOFinishedInspection(
        data.inspectionId,
        checklistResultsStr,
        inspectorId,
        data.status
      );

      return successResponse(inspection, `Inspection updated - status: ${data.status}`);
    } catch (error) {
      console.error('Error updating WO finished inspection:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/work-orders/[id]/finished-inspection - Re-inspect
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

      if (!data.inspectionId) {
        return errorResponse('Missing inspectionId');
      }

      // Use session user as re-inspector if not specified
      const reInspectorId = data.reInspectorId || session.userId;

      const inspection = await reInspectWOFinishedInspection(data.inspectionId, reInspectorId);
      return successResponse(inspection, 'Re-inspection recorded');
    } catch (error) {
      console.error('Error re-inspecting WO finished inspection:', error);
      return serverErrorResponse(error);
    }
  });
}
