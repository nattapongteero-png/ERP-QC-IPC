/**
 * GRN line — sign checklist
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { signChecklistSchema } from '@/lib/validation/goods-receipt';
import { signChecklist } from '@/lib/services/goods-receipt-checklist.service';
import { GoodsReceiptError } from '@/types/goods-receipt';

const CHECKLIST_PERMISSION = 'inventory:goods_receipt:checklist';

interface Params {
  params: Promise<{ id: string; lineId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CHECKLIST_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { lineId } = await params;
  const lid = Number.parseInt(lineId, 10);
  if (Number.isNaN(lid)) return NextResponse.json({ error: 'Invalid lineId' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = signChecklistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await signChecklist(lid, parsed.data, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GoodsReceiptError) {
      const status =
        error.code === 'CHECKLIST_INCOMPLETE'
          ? 400
          : error.code === 'NOT_FOUND'
            ? 404
            : 409;
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
