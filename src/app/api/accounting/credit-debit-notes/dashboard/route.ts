/**
 * Credit/Debit Notes Dashboard API (T093)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNoteSummary } from '@/lib/services/credit-debit-note.service';

export async function GET(request: NextRequest) {
  try {
    const summary = await getNoteSummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error getting notes dashboard:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
