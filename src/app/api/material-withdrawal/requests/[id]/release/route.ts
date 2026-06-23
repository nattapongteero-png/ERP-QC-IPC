/**
 * POST /api/material-withdrawal/requests/[id]/release
 *
 * Warehouse releases a supervisor-approved out-of-BOM withdrawal. THIS is where
 * stock is physically deducted (FEFO). No e-signature — the supervisor already
 * e-signed at approve; this is a warehouse picking action (confirm only),
 * mirroring the BOM requisition release.
 *
 * Requires permission `inventory:write` (warehouse).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { releaseWithdrawalRequestSchema } from '@/lib/validation/material-withdrawal';
import { releaseRequest } from '@/lib/services/material-withdrawal.service';
import { MaterialWithdrawalError } from '@/types/material-withdrawal';
import { realtimeBus } from '@/lib/realtime';

const RELEASE_PERMISSION = 'inventory:write';

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
    if (!perms.has(RELEASE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId) || requestId <= 0) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = releaseWithdrawalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await releaseRequest(requestId, parsed.data, session.userId);
    // Notify the merged requisitions page (same channel the BOM flow uses).
    realtimeBus.publish('requisition-changed', {
      source: 'out_of_bom',
      requestId,
      status: 'released',
      changedBy: session.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MaterialWithdrawalError) {
      const statusByCode: Record<string, number> = {
        REQUEST_NOT_APPROVED: 409,
        INSUFFICIENT_STOCK: 409,
      };
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('[material-withdrawal] release failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
