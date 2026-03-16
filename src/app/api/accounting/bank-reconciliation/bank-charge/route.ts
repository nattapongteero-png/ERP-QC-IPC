/**
 * Bank Charge Journal API (T067)
 * POST /api/accounting/bank-reconciliation/bank-charge - Create bank charge journal
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { createBankChargeJournal } from '@/lib/services/bank-reconciliation.service';
import { bankChargeJournalInputSchema } from '@/lib/validation/bank-reconciliation';

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = bankChargeJournalInputSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const result = await createBankChargeJournal(data, userId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        journalEntryId: result.journalEntryId,
      });
    } catch (error) {
      console.error('Error creating bank charge journal:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}
