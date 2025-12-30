/**
 * Post Variances API (T143)
 * POST /api/accounting/variances/post
 */

import { NextRequest, NextResponse } from 'next/server';
import { postVariances } from '@/lib/services/variance-analysis.service';
import { postVarianceRequestSchema } from '@/lib/validation/variance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = postVarianceRequestSchema.parse(body);

    // TODO: Get actual user ID from session
    const userId = 1;

    const result = await postVariances(data.varianceIds, data.periodId, userId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error posting variances:', error);
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
