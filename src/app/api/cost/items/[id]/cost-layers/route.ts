/**
 * API Route: GET /api/cost/items/[id]/cost-layers
 * Returns cost layer history for an item with pagination and filters
 */

import { NextResponse } from 'next/server';
import { listItemCostLayers } from '@/lib/services/unit-cost.service';
import { costLayerListFiltersSchema } from '@/lib/validation/unit-cost';

export async function GET(
  request: Request,
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filterParams = {
      itemId,
      transactionType: searchParams.get('transactionType') || undefined,
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
    };

    // Validate filters
    const validation = costLayerListFiltersSchema.safeParse(filterParams);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: validation.error.issues },
        { status: 400 }
      );
    }

    const result = await listItemCostLayers(validation.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching item cost layers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost layers' },
      { status: 500 }
    );
  }
}
