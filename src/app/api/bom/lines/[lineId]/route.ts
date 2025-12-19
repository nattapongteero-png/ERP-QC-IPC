import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { updateBOMLine, removeBOMLine } from '@/lib/services/production.service';

// PUT /api/bom/lines/[lineId] - Update a BOM line
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { lineId } = await params;
      const id = parseInt(lineId);

      if (isNaN(id)) {
        return errorResponse('Invalid line ID');
      }

      const body = await request.json();
      const { quantity, unit, sequence, isOptional, notes } = body;

      // Validate quantity if provided
      if (quantity !== undefined && quantity <= 0) {
        return errorResponse('Quantity must be greater than 0');
      }

      await updateBOMLine(
        id,
        {
          quantity,
          unit,
          sequence,
          isOptional,
          notes,
        },
        session.userId
      );

      return successResponse({ id }, 'BOM line updated successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(error.message, 404);
      }
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

// DELETE /api/bom/lines/[lineId] - Remove a BOM line
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { lineId } = await params;
      const id = parseInt(lineId);

      if (isNaN(id)) {
        return errorResponse('Invalid line ID');
      }

      await removeBOMLine(id, session.userId);

      return successResponse({ id }, 'BOM line removed successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(error.message, 404);
      }
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
