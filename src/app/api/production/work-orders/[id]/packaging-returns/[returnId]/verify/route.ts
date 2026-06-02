/**
 * POST verify return (Dual Control: verifier ≠ returner)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { verifyReturnSchema } from '@/lib/validation/packaging';
import { verifyReturn } from '@/lib/services/packaging-return.service';
import { PackagingError } from '@/types/packaging';

const RETURN_PERMISSION = 'production:packaging:return';

interface RouteParams {
  params: Promise<{ id: string; returnId: string }>;
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
  const { returnId } = await params;
  const rid = Number.parseInt(returnId, 10);
  if (Number.isNaN(rid) || rid <= 0) {
    return NextResponse.json({ error: 'Invalid return id' }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = verifyReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const ip = request.headers.get('x-forwarded-for') ?? null;
    const ua = request.headers.get('user-agent') ?? null;
    const detail = await verifyReturn(rid, parsed.data.password, session.userId, {
      ipAddress: ip ?? undefined,
      userAgent: ua ?? undefined,
    });
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof PackagingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: 400 },
      );
    }
    console.error('[packaging-return] verify failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
