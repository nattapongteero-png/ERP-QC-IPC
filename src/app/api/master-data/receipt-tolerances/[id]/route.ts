/**
 * Receipt Tolerances — [id] PUT / DELETE
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { getToleranceById, updateToleranceById } from '@/lib/services/goods-receipt-tolerance.service';
import { dbOperations } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';

const CONFIG_PERMISSION = 'inventory:goods_receipt:configure';

async function checkPermission() {
  const session = await getSession();
  if (!session) return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return { session: null, error: NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 }) };
    }
  }
  return { session, error: null };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission();
  if (error) return error;

  const { id } = await params;
  const item = await getToleranceById(Number(id));
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, data: item });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission();
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const updated = await updateToleranceById(Number(id), {
    tolerancePercent: body.tolerancePercent != null ? Number(body.tolerancePercent) : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    notes: body.notes ?? null,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await checkPermission();
  if (error) return error;

  const { id } = await params;
  const result = await dbOperations.deleteOrDisableById('receiptTolerances', Number(id), {
    updatedAt: getNow(),
  });
  return NextResponse.json({ success: true, mode: result.mode });
}
