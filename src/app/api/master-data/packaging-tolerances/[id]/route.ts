/**
 * Packaging Tolerance — GET (single) + PUT (update one) by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { updateToleranceSchema } from '@/lib/validation/packaging';
import { listTolerances, updateTolerance } from '@/lib/services/packaging-return.service';
import { dbOperations } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';

const VIEW_PERMISSION = 'production:packaging:return';
const CONFIGURE_PERMISSION = 'production:packaging:configure';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(VIEW_PERMISSION) && !perms.has(CONFIGURE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid) || tid <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const all = await listTolerances(true);
  const item = all.find((t) => t.id === tid);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: item });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIGURE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid) || tid <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateToleranceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  await updateTolerance(tid, parsed.data);
  return NextResponse.json({ success: true });
}

/**
 * Delete a tolerance, or soft-disable it when it is referenced elsewhere.
 * Policy: "ไม่เคยใช้ → ลบจริง / เคยใช้ → ปิดการใช้งานเท่านั้น".
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIGURE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const tid = Number.parseInt(id, 10);
  if (Number.isNaN(tid) || tid <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const result = await dbOperations.deleteOrDisableById('packagingTolerances', tid, {
    updatedAt: getNow(),
  });
  return NextResponse.json({ success: true, mode: result.mode });
}
