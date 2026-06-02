/**
 * GET /api/material-withdrawal/pending
 *
 * Supervisor queue — pending requests visible to the calling supervisor.
 * Scoping: filtered by factoryCode (query) if provided; otherwise returns
 * all pending requests this supervisor can act on (current implementation
 * uses a permission gate only — future refinement may scope by team).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { listPendingRequestsForSupervisor } from '@/lib/services/material-withdrawal.service';

const APPROVE_PERMISSION = 'production:withdrawal:approve';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
  if (!perms.has(APPROVE_PERMISSION)) {
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const factoryCode = request.nextUrl.searchParams.get('factoryCode') ?? undefined;
  const items = await listPendingRequestsForSupervisor(session.userId, factoryCode);
  return NextResponse.json(items);
}
