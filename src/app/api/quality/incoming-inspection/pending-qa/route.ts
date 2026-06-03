/**
 * Incoming Inspection — Pending QA list
 * Feature: 020-goods-receipt
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPendingQaList } from '@/lib/services/goods-receipt-dashboard.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await getPendingQaList();
  return NextResponse.json({ items, total: items.length });
}
