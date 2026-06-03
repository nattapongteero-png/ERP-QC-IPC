/**
 * Water Quality Spec — PUT + DELETE (soft via isActive=false)
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

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
    const t = getTableRef('waterQualitySpecs');
    const patch: Record<string, unknown> = {};
    if (typeof body.parameter === 'string') patch.parameter = body.parameter;
    if (typeof body.unit === 'string') patch.unit = body.unit;
    if (body.specMin !== undefined) patch.specMin = body.specMin === null ? null : Number(body.specMin);
    if (body.specMax !== undefined) patch.specMax = body.specMax === null ? null : Number(body.specMax);
    if (typeof body.notes === 'string') patch.notes = body.notes;
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
    const t = getTableRef('waterQualitySpecs');
    await db.update(t).set({ isActive: false }).where(eq(t.id, sid));
  });
  return NextResponse.json({ success: true });
}
