/**
 * Standard Costs API (T136)
 * GET /api/accounting/standard-costs - List standard costs
 * POST /api/accounting/standard-costs - Create standard cost
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStandardCost, listStandardCosts } from '@/lib/services/variance-analysis.service';
import {
  standardCostCreateSchema,
  standardCostListFilterSchema,
} from '@/lib/validation/variance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = standardCostListFilterSchema.parse({
      itemId: searchParams.get('item_id'),
      isCurrent: searchParams.get('is_current'),
      effectiveDate: searchParams.get('effective_date'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const result = await listStandardCosts(filters);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing standard costs:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = standardCostCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const userId = 1;

    const id = await createStandardCost(data, userId);
    return NextResponse.json({ success: true, data: { id } }, { status: 201 });
  } catch (error) {
    console.error('Error creating standard cost:', error);
    if ((error as any).name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: (error as any).errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
