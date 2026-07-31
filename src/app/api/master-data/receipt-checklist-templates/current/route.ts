/**
 * Current Receipt Checklist Template — read-only, self-seeding.
 *
 * The receive dialog (PO → รับสินค้าเข้าคลัง) needs the *current* checklist for a
 * category to render its tick-boxes. The admin list endpoint (`../route.ts`)
 * returns an array and does NOT seed defaults, so on a fresh database it comes
 * back empty and no checklist renders. `getCurrentTemplate` self-seeds default
 * v1 on first call, so this route always returns a usable template with items.
 *
 * GET only, any authenticated user (receiving staff must read it). Editing the
 * template stays on the admin POST/DELETE in the sibling route.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCurrentTemplate } from '@/lib/services/goods-receipt-checklist.service';
import type { ChecklistCategory } from '@/types/goods-receipt';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const category = (request.nextUrl.searchParams.get('category') ?? 'raw_material') as ChecklistCategory;
  const template = await getCurrentTemplate(category, session.userId);
  return NextResponse.json(template);
}
