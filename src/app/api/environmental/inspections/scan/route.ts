/**
 * Trigger scan for due/overdue inspections
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { scanDueInspections } from '@/lib/services/environmental-inspection.service';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await scanDueInspections();
  return NextResponse.json(result);
}
