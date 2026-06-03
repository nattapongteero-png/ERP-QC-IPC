/**
 * Receipt Tolerances — admin GET/POST
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { listTolerances, upsertTolerance } from '@/lib/services/goods-receipt-tolerance.service';
import { CHECKLIST_CATEGORIES, type ChecklistCategory } from '@/types/goods-receipt';

const CONFIG_PERMISSION = 'inventory:goods_receipt:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
  const items = await listTolerances(includeInactive);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role)) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const category = String(body?.category ?? '');
  if (!CHECKLIST_CATEGORIES.includes(category as ChecklistCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const created = await upsertTolerance({
    category: category as ChecklistCategory,
    tolerancePercent: body.tolerancePercent != null ? Number(body.tolerancePercent) : undefined,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    notes: body.notes ?? null,
  });
  return NextResponse.json(created, { status: 201 });
}
