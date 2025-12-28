/**
 * Bank Reconciliation Dashboard API (T068)
 * GET /api/accounting/bank-reconciliation/dashboard - Get dashboard summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBankReconciliationDashboard } from '@/lib/services/bank-reconciliation.service';

export async function GET(request: NextRequest) {
  try {
    const summary = await getBankReconciliationDashboard();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
