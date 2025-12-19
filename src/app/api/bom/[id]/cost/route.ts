import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { calculateBOMCost } from '@/lib/services/production.service';

// GET /api/bom/[id]/cost - Calculate BOM cost
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const bomId = parseInt(id);

      if (isNaN(bomId)) {
        return errorResponse('Invalid BOM ID');
      }

      const { searchParams } = new URL(request.url);
      const quantity = searchParams.get('quantity');
      const targetQuantity = quantity ? parseFloat(quantity) : undefined;

      const costResult = await calculateBOMCost(bomId, targetQuantity);

      return successResponse(costResult);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return errorResponse(error.message, 404);
      }
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}
