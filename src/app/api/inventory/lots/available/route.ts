import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getAvailableLots } from '@/lib/services/inventory.service';

// GET /api/inventory/lots/available?itemId=XX - Get available lots for lot selection
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const itemId = searchParams.get('itemId');

      if (!itemId || isNaN(Number(itemId))) {
        return errorResponse('Valid itemId is required', 400);
      }

      const lots = await getAvailableLots(Number(itemId));
      return successResponse(lots);
    } catch (error) {
      console.error('Error fetching available lots:', error);
      return serverErrorResponse(error);
    }
  }, ['inventory:read']);
}
