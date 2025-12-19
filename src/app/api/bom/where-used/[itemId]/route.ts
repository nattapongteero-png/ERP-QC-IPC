import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getWhereUsed } from '@/lib/services/production.service';

// GET /api/bom/where-used/[itemId] - Get all BOMs that use a specific item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { itemId } = await params;
      const id = parseInt(itemId);

      if (isNaN(id)) {
        return errorResponse('Invalid item ID');
      }

      const whereUsedResults = await getWhereUsed(id);

      return successResponse({
        itemId: id,
        usedInBOMs: whereUsedResults,
        totalUsages: whereUsedResults.length,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}
