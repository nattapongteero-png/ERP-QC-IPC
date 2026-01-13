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

      // Validate required fields - checklistResults is optional on create (will be filled later)
      if (!data.sampleDate) {
        return errorResponse('Missing required field: sampleDate');
      }

      // Use session user as sampler if not specified
      const samplerId = data.samplerId || session.userId;

      // Default to empty checklist if not provided
      const checklistResultsStr = data.checklistResults
        ? (typeof data.checklistResults === 'object'
            ? JSON.stringify(data.checklistResults)
            : data.checklistResults)
        : '{}';

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

      // Validate required fields - inspectionId can come from body or we get the existing inspection
      if (!data.checklistResults) {
        return errorResponse('Missing required field: checklistResults');
      }

      // Get inspection ID from body or fetch existing inspection for this WO
      let inspectionId = data.inspectionId || data.id;
      if (!inspectionId) {
        const existing = await getWOFinishedInspection(workOrderId);
        if (!existing) {
          return errorResponse('No inspection found for this work order');
        }
        inspectionId = existing.id;
      }

      // Parse checklistResults
      let checklistObj: Record<string, boolean>;
      try {
        checklistObj = typeof data.checklistResults === 'string'
          ? JSON.parse(data.checklistResults)
          : data.checklistResults;
      } catch {
        return errorResponse('Invalid checklistResults JSON format');
      }

      // Auto-determine status based on checklistResults (all true = pass, any false = fail)
      const allPassed = Object.values(checklistObj).every(v => v === true);
      const status = data.status || (allPassed ? 'passed' : 'failed');

      // Use session user as inspector if not specified
      const inspectorId = data.inspectorId || session.userId;

      const checklistResultsStr = JSON.stringify(checklistObj);

      const inspection = await updateWOFinishedInspection(
        inspectionId,
        checklistResultsStr,
        inspectorId,
        status
      );

      return successResponse(inspection, `Inspection updated - status: ${status}`);
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

      // Try to get data from body, but it might be empty for simple re-inspect calls
      let data: { inspectionId?: number; reInspectorId?: number } = {};
      try {
        data = await request.json();
      } catch {
        // Body might be empty, that's ok
      }

      // Get inspection ID from body or fetch existing inspection for this WO
      let inspectionId = data.inspectionId;
      if (!inspectionId) {
        const existing = await getWOFinishedInspection(workOrderId);
        if (!existing) {
          return errorResponse('No inspection found for this work order');
        }
        inspectionId = existing.id;
      }

      // Use session user as re-inspector if not specified
      const reInspectorId = data.reInspectorId || session.userId;

      const inspection = await reInspectWOFinishedInspection(inspectionId!, reInspectorId);
      return successResponse(inspection, 'Re-inspection recorded');
    } catch (error) {
      console.error('Error re-inspecting WO finished inspection:', error);
      return serverErrorResponse(error);
    }
  });
}
