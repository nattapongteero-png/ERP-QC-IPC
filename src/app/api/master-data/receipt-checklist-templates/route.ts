/**
 * Receipt Checklist Templates — admin GET/POST
 * Feature: 020-goods-receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createChecklistTemplateSchema } from '@/lib/validation/goods-receipt';
import { listTemplates, createTemplateVersion } from '@/lib/services/goods-receipt-checklist.service';
import type { ChecklistCategory } from '@/types/goods-receipt';

const CONFIG_PERMISSION = 'inventory:goods_receipt:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const category = request.nextUrl.searchParams.get('category') as ChecklistCategory | null;
  const includeHistorical = request.nextUrl.searchParams.get('includeHistorical') === 'true';
  const items = await listTemplates(category ?? undefined, includeHistorical);
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
  const parsed = createChecklistTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const created = await createTemplateVersion(
    parsed.data.category,
    parsed.data.items,
    session.userId,
  );
  return NextResponse.json(created, { status: 201 });
}
