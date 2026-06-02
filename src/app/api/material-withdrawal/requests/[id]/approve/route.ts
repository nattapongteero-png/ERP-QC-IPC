/**
 * POST /api/material-withdrawal/requests/[id]/approve
 *
 * Approve a pending withdrawal request. Requires:
 *   - permission `production:withdrawal:approve`
 *   - approver != requester (Dual Control)
 *   - valid password (E-signature)
 *
 * On success the service atomically deducts inventory, updates consumption,
 * creates a deviation row, and captures the signature row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { approveWithdrawalRequestSchema } from '@/lib/validation/material-withdrawal';
import { approveRequest } from '@/lib/services/material-withdrawal.service';
import { MaterialWithdrawalError } from '@/types/material-withdrawal';

const APPROVE_PERMISSION = 'production:withdrawal:approve';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(APPROVE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId) || requestId <= 0) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = approveWithdrawalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;
    const result = await approveRequest(requestId, parsed.data, session.userId, {
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MaterialWithdrawalError) {
      const statusByCode: Record<string, number> = {
        DUAL_CONTROL_VIOLATION: 400,
        INVALID_PASSWORD: 400,
        INSUFFICIENT_STOCK: 409,
        REQUEST_NOT_PENDING: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('[material-withdrawal] approve failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
