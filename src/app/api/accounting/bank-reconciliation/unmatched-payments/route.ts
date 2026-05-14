/**
 * Unmatched Payments API (T068)
 * GET /api/accounting/bank-reconciliation/unmatched-payments - Get unmatched payments for matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getUnmatchedPayments } from '@/lib/services/bank-reconciliation.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      const bankAccountId = parseInt(searchParams.get('bankAccountId') || '0', 10);
      const fromDate = searchParams.get('fromDate') || undefined;
      const toDate = searchParams.get('toDate') || undefined;

      if (!bankAccountId) {
        return NextResponse.json(
          { success: false, error: 'Bank account ID is required' },
          { status: 400 }
        );
      }

      const payments = await getUnmatchedPayments(bankAccountId, fromDate, toDate);
      return NextResponse.json({ success: true, data: payments });
    } catch (error) {
      console.error('Error getting unmatched payments:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
