/**
 * POST QA approve return — Triple Independence + atomic 7-side-effect transaction
 *
 * NOTE: admin role DOES NOT bypass Triple Independence (GMP integrity).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { approveReturnSchema } from '@/lib/validation/packaging';
import { approveReturn } from '@/lib/services/packaging-return.service';
import { PackagingError } from '@/types/packaging';

const APPROVE_PERMISSION = 'production:packaging:approve';

interface RouteParams {
  params: Promise<{ id: string; returnId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // For approve, admin still must have permission AND satisfy Triple Independence (per spec FR-022)
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(APPROVE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { returnId } = await params;
  const rid = Number.parseInt(returnId, 10);
  if (Number.isNaN(rid) || rid <= 0) {
    return NextResponse.json({ error: 'Invalid return id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = approveReturnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ip = request.headers.get('x-forwarded-for') ?? null;
    const ua = request.headers.get('user-agent') ?? null;
    const result = await approveReturn(rid, parsed.data, session.userId, {
      ipAddress: ip ?? undefined,
      userAgent: ua ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PackagingError) {
      const statusByCode: Record<string, number> = {
        TRIPLE_INDEPENDENCE_VIOLATION: 400,
        INVALID_PASSWORD: 400,
        RETURN_NOT_PENDING_QA: 409,
        RETURN_NOT_VERIFIED: 409,
        OVERRIDE_REASON_REQUIRED: 400,
      };
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('[packaging-return] approve failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
