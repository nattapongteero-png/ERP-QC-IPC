/**
 * Packaging Tolerances admin API — GET (list) + POST (create)
 * Feature 019
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createToleranceSchema } from '@/lib/validation/packaging';
import { listTolerances, createTolerance } from '@/lib/services/packaging-return.service';

const VIEW_PERMISSION = 'production:packaging:return';
const CONFIGURE_PERMISSION = 'production:packaging:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(VIEW_PERMISSION) && !perms.has(CONFIGURE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
  const items = await listTolerances(includeInactive);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIGURE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createToleranceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const created = await createTolerance(parsed.data, session.userId);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    if (msg.includes('Duplicate') || msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Tolerance for this category already exists', code: 'DUPLICATE' }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
