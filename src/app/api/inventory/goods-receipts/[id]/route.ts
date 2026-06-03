/**
 * Goods Receipt detail — GET, POST cancel via body action
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getGrnById, cancelGrn } from '@/lib/services/goods-receipt.service';
import { cancelGrnSchema } from '@/lib/validation/goods-receipt';
import { GoodsReceiptError } from '@/types/goods-receipt';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const gid = Number.parseInt(id, 10);
  if (Number.isNaN(gid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const result = await getGrnById(gid);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GoodsReceiptError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const gid = Number.parseInt(id, 10);
  if (Number.isNaN(gid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = cancelGrnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Reason required (min 10 chars)' }, { status: 400 });
  }

  try {
    await cancelGrn(gid, parsed.data.reason, session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof GoodsReceiptError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.code === 'PERMISSION_DENIED' ? 403 : 409 },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
