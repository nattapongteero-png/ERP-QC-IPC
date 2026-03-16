/**
 * Manual Match API (T065)
 * POST /api/accounting/bank-reconciliation/match - Manual match
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { manualMatch } from '@/lib/services/bank-reconciliation.service';
import { manualMatchInputSchema } from '@/lib/validation/bank-reconciliation';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = manualMatchInputSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await manualMatch(data, userId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error manual matching:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}
