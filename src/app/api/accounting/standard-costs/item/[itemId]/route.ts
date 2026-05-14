/**
 * Current Standard Cost by Item API (T138)
 * GET /api/accounting/standard-costs/item/[itemId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getCurrentStandardCost } from '@/lib/services/variance-analysis.service';

interface RouteContext {
  params: Promise<{ itemId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { itemId } = await context.params;
      const itemIdNum = parseInt(itemId, 10);

      if (isNaN(itemIdNum)) {
        return NextResponse.json(
          { success: false, error: 'Invalid item ID' },
          { status: 400 }
        );
      }

      const cost = await getCurrentStandardCost(itemIdNum);
      if (!cost) {
        return NextResponse.json(
          { success: false, error: 'No standard cost defined for this item' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: cost });
    } catch (error) {
      console.error('Error fetching current standard cost:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
