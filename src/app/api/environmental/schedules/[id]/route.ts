/**
 * Inspection Schedule — PUT + DELETE (soft via isActive=false)
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';

const PERMISSION = 'environmental:configure';

interface Params {
  params: Promise<{ id: string }>;
}

async function checkPerm(session: { role?: string }) {
  if (isAdminRole(session.role ?? '')) return true;
  const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
  return perms.has(PERMISSION);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkPerm(session)))
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });

  const { id } = await params;
  const sid = Number.parseInt(id, 10);
  if (Number.isNaN(sid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  await executeDbOperation(async (db) => {
    const t = getTableRef('inspectionSchedules');
    const patch: Record<string, unknown> = { updatedAt: getNow() };
    if (typeof body.targetName === 'string') patch.targetName = body.targetName;
    if (typeof body.frequency === 'string') patch.frequency = body.frequency;
    if (typeof body.alertDaysBefore === 'number') patch.alertDaysBefore = body.alertDaysBefore;
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
    await db.update(t).set(patch).where(eq(t.id, sid));
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkPerm(session)))
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });

  const { id } = await params;
  const sid = Number.parseInt(id, 10);
  if (Number.isNaN(sid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await executeDbOperation(async (db) => {
    const t = getTableRef('inspectionSchedules');
    await db.update(t).set({ isActive: false, updatedAt: getNow() }).where(eq(t.id, sid));
  });
  return NextResponse.json({ success: true });
}
