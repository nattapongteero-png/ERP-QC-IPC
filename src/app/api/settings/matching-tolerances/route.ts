/**
 * Matching Tolerances API (T108)
 * GET /api/settings/matching-tolerances - List tolerances
 * POST /api/settings/matching-tolerances - Create tolerance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTolerance, listTolerances } from '@/lib/services/matching.service';
import { toleranceCreateSchema, toleranceListFilterSchema } from '@/lib/validation/matching';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = toleranceListFilterSchema.parse({
      toleranceType: searchParams.get('toleranceType'),
      isActive: searchParams.get('isActive'),
      search: searchParams.get('search'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });

    const result = await listTolerances(filter);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error listing tolerances:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = toleranceCreateSchema.parse(body);

    // TODO: Get actual user ID from session
    const userId = 1;

    const id = await createTolerance(data, userId);
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) {
    console.error('Error creating tolerance:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
