import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { getLotsForPicking, reserveLots } from '@/lib/services/inventory.service';

// GET - Get FEFO allocation for an item
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const itemId = parseInt(searchParams.get('itemId') || '0');
      const quantity = parseFloat(searchParams.get('quantity') || '0');
      const warehouseId = searchParams.get('warehouseId') ? parseInt(searchParams.get('warehouseId')!) : undefined;

      if (!itemId || !quantity) {
        return errorResponse('itemId and quantity are required', 400);
      }

      const result = await getLotsForPicking(itemId, quantity, warehouseId);

      return successResponse({
        allocated: result.allocated,
        remaining: result.remaining,
        canFulfill: result.remaining === 0,
        message: result.remaining > 0 
          ? `Insufficient stock. Short by ${result.remaining}` 
          : 'Full allocation available',
      });
    } catch (error) {
      console.error('FEFO allocation error:', error);
      return errorResponse('Failed to calculate FEFO allocation', 500);
    }
  });
}

// POST - Reserve lots for an order
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { allocations, referenceType, referenceId } = body;

      if (!allocations || !referenceType || !referenceId) {
        return errorResponse('allocations, referenceType, and referenceId are required', 400);
      }

      await reserveLots(allocations, referenceType, referenceId, user.userId);

      return successResponse({ message: 'Lots reserved successfully' });
    } catch (error) {
      console.error('Reserve lots error:', error);
      return errorResponse('Failed to reserve lots', 500);
    }
  });
}
