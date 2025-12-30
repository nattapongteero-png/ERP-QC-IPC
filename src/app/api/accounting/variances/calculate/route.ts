/**
 * Calculate Variances API (T142)
 * POST /api/accounting/variances/calculate
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateWorkOrderVariances, postVariances } from '@/lib/services/variance-analysis.service';
import { calculateVarianceRequestSchema } from '@/lib/validation/variance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = calculateVarianceRequestSchema.parse(body);

    // TODO: Get actual user ID from session
    const userId = 1;

    const result = await calculateWorkOrderVariances(data.workOrderId, userId);

    // Post immediately if requested
    if (data.postImmediately && result.variances.length > 0) {
      const varianceIds = result.variances.map((v) => v.id);
      const postResult = await postVariances(varianceIds, undefined, userId);
      result.journalEntryId = postResult.journalEntriesCreated > 0 ? 1 : undefined; // Simplified
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error calculating variances:', error);
    if ((error as any).name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: (error as any).errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
