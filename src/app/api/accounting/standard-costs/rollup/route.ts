/**
 * Standard Cost Roll-up API (T139)
 * POST /api/accounting/standard-costs/rollup
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { rollupStandardCosts } from '@/lib/services/variance-analysis.service';
import { rollupRequestSchema } from '@/lib/validation/variance';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = rollupRequestSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await rollupStandardCosts(data.itemIds, data.effectiveDate, userId);
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      console.error('Error rolling up standard costs:', error);
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

  });
}
