/**
 * GRN line — PATCH actuals
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { updateGrnLineSchema } from '@/lib/validation/goods-receipt';
import { updateGrnLine } from '@/lib/services/goods-receipt.service';
import { GoodsReceiptError } from '@/types/goods-receipt';

const RECEIVE_PERMISSION = 'inventory:goods_receipt:receive';

interface Params {
  params: Promise<{ id: string; lineId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(RECEIVE_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { lineId } = await params;
  const lid = Number.parseInt(lineId, 10);
  if (Number.isNaN(lid)) return NextResponse.json({ error: 'Invalid lineId' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateGrnLineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const line = await updateGrnLine(lid, parsed.data, session.userId);
    return NextResponse.json(line);
  } catch (error) {
    if (error instanceof GoodsReceiptError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.code === 'NOT_FOUND' ? 404 : 409 },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
