import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getSOPTemplateSteps,
  addSOPTemplateStep,
  updateSOPTemplateStep,
  removeSOPTemplateStep,
  reorderSOPTemplateSteps,
} from '@/lib/services/sop-template-steps.service';

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/master-data/sop-templates/[id]/steps
export async function GET(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const templateId = Number(id);
      if (isNaN(templateId)) return errorResponse('Invalid template ID');

      const steps = await getSOPTemplateSteps(templateId);
      return successResponse(steps);
    } catch (error) {
      console.error('Error fetching SOP template steps:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST /api/master-data/sop-templates/[id]/steps
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const templateId = Number(id);
      if (isNaN(templateId)) return errorResponse('Invalid template ID');

      const data = await request.json();

      if (!data.stepName) {
        return errorResponse('Step name is required');
      }

      // Validate JSON if provided
      if (data.defaultParameters) {
        try {
          if (typeof data.defaultParameters === 'string') {
            JSON.parse(data.defaultParameters);
          }
        } catch {
          return errorResponse('defaultParameters must be valid JSON');
        }
      }

      const step = await addSOPTemplateStep({
        templateId,
        sequence: data.sequence || 1,
        stepName: data.stepName,
        stepNameTh: data.stepNameTh || null,
        instructions: data.instructions || null,
        instructionsTh: data.instructionsTh || null,
        defaultParameters: data.defaultParameters || null,
      });

      return successResponse(step, 'Step added successfully');
    } catch (error) {
      console.error('Error adding SOP template step:', error);
      return serverErrorResponse(error);
    }
  });
}

// PUT /api/master-data/sop-templates/[id]/steps
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const templateId = Number(id);
      if (isNaN(templateId)) return errorResponse('Invalid template ID');

      const data = await request.json();
      if (!data.stepId) return errorResponse('stepId is required');

      // Validate JSON if provided
      if (data.defaultParameters) {
        try {
          if (typeof data.defaultParameters === 'string') {
            JSON.parse(data.defaultParameters);
          }
        } catch {
          return errorResponse('defaultParameters must be valid JSON');
        }
      }

      const updateData: Record<string, unknown> = {};
      if (data.stepName !== undefined) updateData.stepName = data.stepName;
      if (data.stepNameTh !== undefined) updateData.stepNameTh = data.stepNameTh;
      if (data.instructions !== undefined) updateData.instructions = data.instructions;
      if (data.instructionsTh !== undefined) updateData.instructionsTh = data.instructionsTh;
      if (data.defaultParameters !== undefined) updateData.defaultParameters = data.defaultParameters;
      if (data.sequence !== undefined) updateData.sequence = data.sequence;

      const step = await updateSOPTemplateStep(data.stepId, updateData);
      return successResponse(step, 'Step updated successfully');
    } catch (error) {
      console.error('Error updating SOP template step:', error);
      return serverErrorResponse(error);
    }
  });
}

// DELETE /api/master-data/sop-templates/[id]/steps?stepId=123
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const templateId = Number(id);
      if (isNaN(templateId)) return errorResponse('Invalid template ID');

      const { searchParams } = new URL(request.url);
      const stepId = searchParams.get('stepId');
      if (!stepId) return errorResponse('stepId query parameter is required');

      await removeSOPTemplateStep(Number(stepId));
      return successResponse(null, 'Step removed successfully');
    } catch (error) {
      console.error('Error removing SOP template step:', error);
      return serverErrorResponse(error);
    }
  });
}

// PATCH /api/master-data/sop-templates/[id]/steps - Reorder steps
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const templateId = Number(id);
      if (isNaN(templateId)) return errorResponse('Invalid template ID');

      const data = await request.json();
      if (!data.stepIds || !Array.isArray(data.stepIds)) {
        return errorResponse('stepIds array is required');
      }

      const steps = await reorderSOPTemplateSteps(templateId, data.stepIds);
      return successResponse(steps, 'Steps reordered successfully');
    } catch (error) {
      console.error('Error reordering SOP template steps:', error);
      return serverErrorResponse(error);
    }
  });
}
