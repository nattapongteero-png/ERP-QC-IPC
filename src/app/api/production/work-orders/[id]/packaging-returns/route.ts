/**
 * Packaging Returns — POST (create) + GET (list)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createReturnSchema } from '@/lib/validation/packaging';
import { createReturn, listReturnsForWO } from '@/lib/services/packaging-return.service';
import { PackagingError, type ReturnStatus } from '@/types/packaging';

const RETURN_PERMISSION = 'production:packaging:return';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(RETURN_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }
  const { id } = await params;
  const workOrderId = Number.parseInt(id, 10);
  if (Number.isNaN(workOrderId) || workOrderId <= 0) {
    return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = createReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = await createReturn(workOrderId, parsed.data, session.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PackagingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: 400 },
      );
    }
    console.error('[packaging-return] POST failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const workOrderId = Number.parseInt(id, 10);
  if (Number.isNaN(workOrderId) || workOrderId <= 0) {
    return NextResponse.json({ error: 'Invalid work order id' }, { status: 400 });
  }
  const status = request.nextUrl.searchParams.get('status') as ReturnStatus | null;
  const items = await listReturnsForWO(workOrderId, status ?? undefined);
  return NextResponse.json(items);
}
