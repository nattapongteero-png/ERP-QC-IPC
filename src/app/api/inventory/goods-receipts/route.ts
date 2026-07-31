/**
 * Goods Receipts collection — GET list, POST create
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createGrnSchema } from '@/lib/validation/goods-receipt';
import { createGrn, listGrns } from '@/lib/services/goods-receipt.service';
import { GoodsReceiptError } from '@/types/goods-receipt';

const RECEIVE_PERMISSION = 'inventory:goods_receipt:receive';

async function requirePermission(session: { role?: string } | null, perm: string): Promise<boolean> {
  if (!session) return false;
  if (isAdminRole(session.role ?? '')) return true;
  const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
  return perms.has(perm);
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const result = await listGrns({
    status: (sp.get('status') as any) ?? undefined,
    workflowStatus: (sp.get('workflowStatus') as any) ?? undefined,
    sourceType: (sp.get('sourceType') as any) ?? undefined,
    vendorId: sp.get('vendorId') ? Number(sp.get('vendorId')) : undefined,
    dateFrom: sp.get('dateFrom') ?? undefined,
    dateTo: sp.get('dateTo') ?? undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : undefined,
    // Register gate — the caller opts in; other consumers keep the full list.
    receivedOnly: sp.get('receivedOnly') === 'true' ? true : undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await requirePermission(session, RECEIVE_PERMISSION))) {
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createGrnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await createGrn(parsed.data, session.userId);
    return NextResponse.json(result, { status: 201 });
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
