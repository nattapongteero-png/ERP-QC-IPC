/**
 * Material Withdrawal Request Detail / Cancel API
 *
 * GET    /api/material-withdrawal/requests/[id] — detail
 * DELETE /api/material-withdrawal/requests/[id] — cancel pending (own only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { cancelRequest, getRequestById } from '@/lib/services/material-withdrawal.service';
import { MaterialWithdrawalError } from '@/types/material-withdrawal';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId) || requestId <= 0) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  const detail = await getRequestById(requestId, session.userId);
  if (!detail) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(detail);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const requestId = Number.parseInt(id, 10);
  if (Number.isNaN(requestId) || requestId <= 0) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
  }

  try {
    await cancelRequest(requestId, session.userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof MaterialWithdrawalError) {
      const statusByCode: Record<string, number> = {
        REQUEST_NOT_PENDING: 409,
        PERMISSION_DENIED: 403,
      };
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('[material-withdrawal] DELETE /requests/[id] failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
