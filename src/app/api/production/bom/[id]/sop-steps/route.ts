import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getBOMSOPSteps,
  getBOMSOPStepById,
  addBOMSOPStep,
  updateBOMSOPStep,
  removeBOMSOPStep,
  reorderBOMSOPSteps,
} from '@/lib/services/bom-configuration.service';

// GET /api/production/bom/[id]/sop-steps - Get SOP steps for BOM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const steps = await getBOMSOPSteps(bomId);
      return successResponse(steps);
    } catch (error) {
      console.error('Error fetching BOM SOP steps:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/production/bom/[id]/sop-steps - Add SOP step (from template or custom)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const data = await request.json();

      // Validate required fields
      if (!data.stepName || data.sequence === undefined) {
        return errorResponse('Missing required fields: stepName, sequence');
      }

      // Validate parameters and equipmentIds JSON if provided
      if (data.parameters) {
        try {
          if (typeof data.parameters === 'string') {
            JSON.parse(data.parameters);
          }
        } catch {
          return errorResponse('Invalid parameters JSON format');
        }
      }

      if (data.equipmentIds) {
        try {
          if (typeof data.equipmentIds === 'string') {
            JSON.parse(data.equipmentIds);
          }
        } catch {
          return errorResponse('Invalid equipmentIds JSON format');
        }
      }

      const step = await addBOMSOPStep({
        bomId,
        templateId: data.templateId,
        sequence: data.sequence,
        stepName: data.stepName,
        stepNameTh: data.stepNameTh,
        instructions: data.instructions,
        instructionsTh: data.instructionsTh,
        parameters: typeof data.parameters === 'object'
          ? JSON.stringify(data.parameters)
          : data.parameters,
        equipmentIds: typeof data.equipmentIds === 'object'
          ? JSON.stringify(data.equipmentIds)
          : data.equipmentIds,
        requiresVerification: data.requiresVerification ?? true,
      });

      return successResponse(step, 'SOP step added to BOM');
    } catch (error) {
      console.error('Error adding BOM SOP step:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/production/bom/[id]/sop-steps - Update step parameters
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const data = await request.json();

      if (!data.bomStepId) {
        return errorResponse('Missing bomStepId');
      }

      // Validate parameters and equipmentIds JSON if provided
      if (data.parameters) {
        try {
          if (typeof data.parameters === 'string') {
            JSON.parse(data.parameters);
          }
        } catch {
          return errorResponse('Invalid parameters JSON format');
        }
      }

      if (data.equipmentIds) {
        try {
          if (typeof data.equipmentIds === 'string') {
            JSON.parse(data.equipmentIds);
          }
        } catch {
          return errorResponse('Invalid equipmentIds JSON format');
        }
      }

      const step = await updateBOMSOPStep(data.bomStepId, {
        templateId: data.templateId,
        sequence: data.sequence,
        stepName: data.stepName,
        stepNameTh: data.stepNameTh,
        instructions: data.instructions,
        instructionsTh: data.instructionsTh,
        parameters: typeof data.parameters === 'object'
          ? JSON.stringify(data.parameters)
          : data.parameters,
        equipmentIds: typeof data.equipmentIds === 'object'
          ? JSON.stringify(data.equipmentIds)
          : data.equipmentIds,
        requiresVerification: data.requiresVerification,
      });

      return successResponse(step, 'SOP step updated');
    } catch (error) {
      console.error('Error updating BOM SOP step:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/production/bom/[id]/sop-steps - Remove step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const { searchParams } = new URL(request.url);
      const bomStepId = searchParams.get('bomStepId');

      if (!bomStepId) {
        return errorResponse('Missing bomStepId parameter');
      }

      await removeBOMSOPStep(Number(bomStepId));
      return successResponse(null, 'SOP step removed from BOM');
    } catch (error) {
      console.error('Error removing BOM SOP step:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/production/bom/[id]/sop-steps - Reorder steps
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = Number(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const data = await request.json();

      if (!data.stepIds || !Array.isArray(data.stepIds)) {
        return errorResponse('Missing or invalid stepIds array');
      }

      const steps = await reorderBOMSOPSteps(bomId, data.stepIds);
      return successResponse(steps, 'SOP steps reordered');
    } catch (error) {
      console.error('Error reordering BOM SOP steps:', error);
      return serverErrorResponse(error);
    }
  });
}
