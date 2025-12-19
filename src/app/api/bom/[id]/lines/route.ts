import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { addBOMLine } from '@/lib/services/production.service';

// POST /api/bom/[id]/lines - Add a new line to BOM
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const body = await request.json();
      const { itemId, quantity, unit, sequence, isOptional, notes } = body;

      if (!itemId || !quantity || !unit) {
        return errorResponse('Item ID, quantity, and unit are required');
      }

      if (quantity <= 0) {
        return errorResponse('Quantity must be greater than 0');
      }

      const lineId = await addBOMLine(
        bomId,
        {
          itemId,
          quantity,
          unit,
          sequence,
          isOptional,
          notes,
        },
        session.userId
      );

      return successResponse(
        { id: lineId },
        'BOM line added successfully'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return errorResponse(error.message, 404);
        }
        if (error.message.includes('already exists') || error.message.includes('Circular')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
