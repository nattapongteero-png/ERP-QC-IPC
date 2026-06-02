/**
 * Packaging Tolerance — PUT (update one) by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { updateToleranceSchema } from '@/lib/validation/packaging';
import { updateTolerance } from '@/lib/services/packaging-return.service';

const CONFIGURE_PERMISSION = 'production:packaging:configure';

interface RouteParams {
  params: Promise<{ id: string }>;
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
