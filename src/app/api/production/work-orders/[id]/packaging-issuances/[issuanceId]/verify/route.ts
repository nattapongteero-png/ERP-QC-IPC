/**
 * POST /api/production/work-orders/{id}/packaging-issuances/{issuanceId}/verify
 *
 * Verifier signs e-sig; flow_status → 'issued', stock deducted.
 * Dual Control enforced (verifier ≠ operator).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { verifyIssuanceSchema } from '@/lib/validation/packaging';
import { verifyIssuance } from '@/lib/services/packaging-issuance.service';
import { PackagingError } from '@/types/packaging';

const ISSUE_PERMISSION = 'production:packaging:issue';

interface RouteParams {
  params: Promise<{ id: string; issuanceId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(ISSUE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }
  const { issuanceId } = await params;
  const id = Number.parseInt(issuanceId, 10);
  if (Number.isNaN(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid issuance id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = verifyIssuanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ip = request.headers.get('x-forwarded-for') ?? null;
    const ua = request.headers.get('user-agent') ?? null;
    const result = await verifyIssuance(id, parsed.data.password, session.userId, {
      ipAddress: ip ?? undefined,
      userAgent: ua ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PackagingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: 400 },
      );
    }
    console.error('[packaging-issuance] verify failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
