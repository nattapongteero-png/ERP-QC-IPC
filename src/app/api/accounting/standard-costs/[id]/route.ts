/**
 * Standard Cost Detail API (T137)
 * GET /api/accounting/standard-costs/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStandardCostById } from '@/lib/services/variance-analysis.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const costId = parseInt(id, 10);

    if (isNaN(costId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID' },
        { status: 400 }
      );
    }

    const cost = await getStandardCostById(costId);
    if (!cost) {
      return NextResponse.json(
        { success: false, error: 'Standard cost not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: cost });
  } catch (error) {
    console.error('Error fetching standard cost:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
