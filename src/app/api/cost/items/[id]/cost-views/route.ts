/**
 * API Route: GET /api/cost/items/[id]/cost-views
 * Returns all cost views for an item (WAC, standard, last purchase, production, full cost)
 */

import { NextResponse } from 'next/server';
import { getItemCostViews } from '@/lib/services/unit-cost.service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id, 10);

    if (isNaN(itemId)) {
      return NextResponse.json(
        { error: 'Invalid item ID' },
        { status: 400 }
      );
    }

    const costViews = await getItemCostViews(itemId);

    if (!costViews) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(costViews);
  } catch (error) {
    console.error('Error fetching item cost views:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost views' },
      { status: 500 }
    );
  }
}
