import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { checkATP, allocateLotsForOrder } from '@/lib/services/sales.service';

// GET - Check ATP for an item
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const itemId = parseInt(searchParams.get('itemId') || '0');
      const quantity = parseFloat(searchParams.get('quantity') || '0');

      if (!itemId || !quantity) {
        return errorResponse('itemId and quantity are required', 400);
      }

      const atp = await checkATP(itemId, quantity);

      return successResponse(atp);
    } catch (error) {
      console.error('ATP check error:', error);
      return errorResponse('Failed to check ATP', 500);
    }
  });
}

// POST - Allocate lots for a sales order
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { salesOrderId } = body;

      if (!salesOrderId) {
        return errorResponse('salesOrderId is required', 400);
      }

      const allocations = await allocateLotsForOrder(salesOrderId, user.userId);

      return successResponse({
        allocations,
        message: 'Lots allocated successfully using FEFO',
      });
    } catch (error) {
      console.error('Allocate lots error:', error);
      return errorResponse((error as Error).message || 'Failed to allocate lots', 500);
    }
  });
}
