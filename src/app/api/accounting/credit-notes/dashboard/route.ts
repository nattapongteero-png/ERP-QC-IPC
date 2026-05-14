/**
 * Credit/Debit Notes Dashboard API
 * Part of 011-accounting-spec-gap - User Story 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { getCreditDebitNoteDashboard } from '@/lib/services/credit-debit-notes.service';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const summary = await getCreditDebitNoteDashboard();
      return NextResponse.json({ success: true, data: summary });
    } catch (error) {
      console.error('Error getting dashboard:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get dashboard data' },
        { status: 500 }
      );
    }

  });
}
