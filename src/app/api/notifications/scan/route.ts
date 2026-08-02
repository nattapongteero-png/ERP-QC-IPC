/**
 * Trigger scan — walks acct_maintenance_schedules and creates notifications.
 * Can be called from cron / button.
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { scanMaintenanceSchedules, scanEquipmentInspectionsDue } from '@/lib/services/equipment-notification.service';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const maintenance = await scanMaintenanceSchedules();
  // Also scan routine equipment inspections (in-line + off-line production equipment).
  const inspections = await scanEquipmentInspectionsDue();
  return NextResponse.json({
    scanned: maintenance.scanned + inspections.scanned,
    created: maintenance.created + inspections.created,
    skipped: maintenance.skipped + inspections.skipped,
    maintenance,
    inspections,
  });
}
