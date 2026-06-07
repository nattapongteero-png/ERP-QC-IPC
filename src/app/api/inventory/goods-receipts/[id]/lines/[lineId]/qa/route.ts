/**
 * GRN line — QA release / reject
 * Feature: 020-goods-receipt
 *
 * Triple Independence: Receiver ≠ QA Approver (admin role does NOT bypass)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { qaActionSchema } from '@/lib/validation/goods-receipt';
import { qaReleaseLine, qaRejectLine } from '@/lib/services/goods-receipt-qa.service';
import { GoodsReceiptError } from '@/types/goods-receipt';

// Permission depends on the action:
//  - 'release' → warehouse moves the QC-approved lot into stock
//  - 'reject'  → QC rejects the incoming lot (quality decision)
const RELEASE_PERMISSION = 'inventory:goods_receipt:receive';
const REJECT_PERMISSION = 'quality:incoming:approve';

interface Params {
  params: Promise<{ id: string; lineId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lineId } = await params;
  const lid = Number.parseInt(lineId, 10);
  if (Number.isNaN(lid)) return NextResponse.json({ error: 'Invalid lineId' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = qaActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  // Action-aware permission gate (admin bypasses).
  const requiredPerm = parsed.data.action === 'release' ? RELEASE_PERMISSION : REJECT_PERMISSION;
  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(requiredPerm)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  try {
    const result =
      parsed.data.action === 'release'
        ? await qaReleaseLine(lid, parsed.data.signature, session.userId)
        : await qaRejectLine(lid, parsed.data.rejectionReason!, parsed.data.signature, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GoodsReceiptError) {
      const status =
        error.code === 'TRIPLE_INDEPENDENCE_VIOLATION'
          ? 403
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
