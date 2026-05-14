/**
 * Unmatch API (T066)
 * POST /api/accounting/bank-reconciliation/unmatch - Unmatch a line
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { unmatchLine, ignoreLine } from '@/lib/services/bank-reconciliation.service';
import { unmatchInputSchema, ignoreLineInputSchema } from '@/lib/validation/bank-reconciliation';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = unmatchInputSchema.parse(body);

      const result = await unmatchLine(data.statementLineId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error unmatching line:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}

// Also handle ignore as a PUT request
export async function PUT(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = ignoreLineInputSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await ignoreLine(data.statementLineId, data.notes, userId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: 'Failed to ignore line' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error ignoring line:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}
