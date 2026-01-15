/**
 * API Route: GET /api/cost/items/[id]/cost-views
 * Feature: 014-unit-cost (US4 - Multiple Cost View Access)
 *
 * Returns all cost views for an item:
 * - WAC (Weighted Average Cost)
 * - Standard Cost
 * - Last Purchase Cost (with date)
 * - Last Production Cost (with date)
 * - Full Absorption Cost (WAC + SG&A)
 * - Suggested Price (based on target margin)
 *
 * Query params:
 * - margin: Target margin percentage (default: 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getItemCostViewsWithPrice } from '@/lib/services/unit-cost.service';

export async function GET(
  request: NextRequest,
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

    // Get margin from query params, default to 30%
    const searchParams = request.nextUrl.searchParams;
    const marginParam = searchParams.get('margin');
    const marginPercent = marginParam ? parseFloat(marginParam) : 30;

    // Validate margin is in valid range (1-99)
    if (isNaN(marginPercent) || marginPercent < 1 || marginPercent >= 100) {
      return NextResponse.json(
        { error: 'Margin must be between 1 and 99' },
        { status: 400 }
      );
    }

    const costViews = await getItemCostViewsWithPrice(itemId, marginPercent);

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
