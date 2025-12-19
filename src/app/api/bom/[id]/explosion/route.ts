import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  explodeBOM,
  explodeBOMConsolidated,
  detectCircularReference,
} from '@/lib/services/production.service';

// GET /api/bom/[id]/explosion - Explode BOM with options
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
      const quantity = parseFloat(searchParams.get('quantity') || '1');
      const consolidated = searchParams.get('consolidated') === 'true';
      const checkCircular = searchParams.get('checkCircular') !== 'false';

      // Check for circular references first
      if (checkCircular) {
        const circularPath = await detectCircularReference(bomId);
        if (circularPath) {
          return errorResponse(
            `Circular reference detected in BOM structure: ${circularPath.join(' -> ')}`,
            400
          );
        }
      }

      if (consolidated) {
        const result = await explodeBOMConsolidated(bomId, quantity);
        return successResponse({
          type: 'consolidated',
          ...result,
        });
      } else {
        const materials = await explodeBOM(bomId, quantity);
        const canProduce = materials.every((m) => m.shortage === 0);
        const totalShortage = materials.reduce((sum, m) => sum + m.shortage, 0);

        return successResponse({
          type: 'standard',
          materials,
          summary: {
            totalMaterials: materials.length,
            totalRequired: materials.reduce((sum, m) => sum + m.requiredQuantity, 0),
            totalShortage,
            canProduce,
          },
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return errorResponse(error.message, 404);
        }
        if (error.message.includes('Circular reference')) {
          return errorResponse(error.message, 400);
        }
      }
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}
