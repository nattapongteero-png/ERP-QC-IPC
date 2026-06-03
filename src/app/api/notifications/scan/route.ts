/**
 * Trigger scan — walks acct_maintenance_schedules and creates notifications.
 * Can be called from cron / button.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { scanMaintenanceSchedules } from '@/lib/services/equipment-notification.service';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await scanMaintenanceSchedules();
  return NextResponse.json(result);
}
