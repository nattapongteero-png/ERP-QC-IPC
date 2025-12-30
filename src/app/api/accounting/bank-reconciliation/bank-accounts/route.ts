/**
 * Bank Accounts API (T068)
 * GET /api/accounting/bank-reconciliation/bank-accounts - Get bank accounts for dropdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBankAccounts } from '@/lib/services/bank-reconciliation.service';

export async function GET(request: NextRequest) {
  try {
    const accounts = await getBankAccounts();
    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    console.error('Error getting bank accounts:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
