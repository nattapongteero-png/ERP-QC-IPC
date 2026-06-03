/**
 * Inspection Template — PUT + DELETE (soft via isActive=false)
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
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  await executeDbOperation(async (db) => {
    const t = getTableRef('inspectionTemplates');
    const patch: Record<string, unknown> = { updatedAt: getNow() };
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive;
    if (Array.isArray(body.items)) patch.itemsJson = JSON.stringify(body.items);
    await db.update(t).set(patch).where(eq(t.id, tid));
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await checkPerm(session)))
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });

  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await executeDbOperation(async (db) => {
    const t = getTableRef('inspectionTemplates');
    await db.update(t).set({ isActive: false, updatedAt: getNow() }).where(eq(t.id, tid));
  });
  return NextResponse.json({ success: true });
}
