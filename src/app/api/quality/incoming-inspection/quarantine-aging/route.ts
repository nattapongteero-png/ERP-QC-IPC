/**
 * Incoming Inspection — Quarantine aging report
 * Feature: 020-goods-receipt
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getQuarantineAging } from '@/lib/services/goods-receipt-dashboard.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await getQuarantineAging();
  return NextResponse.json(result);
}
