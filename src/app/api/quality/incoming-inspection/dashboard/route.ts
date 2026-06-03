/**
 * Incoming Inspection — dashboard counts
 * Feature: 020-goods-receipt
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDashboardCounts } from '@/lib/services/goods-receipt-dashboard.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const counts = await getDashboardCounts();
  return NextResponse.json(counts);
}
