/**
 * Environmental Targets — list selectable targets by type.
 *
 * The "+ Schedule" / schedule edit popups need a dropdown of available
 * targets per type instead of asking the user to type a numeric ID.
 * This endpoint maps the four target types to their backing tables:
 *
 *   room          → production_rooms
 *   storage_area  → warehouses (excludes quarantine-coded warehouses)
 *   quarantine    → warehouses (only quarantine-coded ones)
 *   water_point   → water_sample_points
 *
 * Always returns { id, name } so the caller can stash both targetId and
 * targetName from a single selection.
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';

type TargetType = 'room' | 'storage_area' | 'quarantine' | 'water_point';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const typeParam = request.nextUrl.searchParams.get('type') as TargetType | null;
  if (!typeParam || !['room', 'storage_area', 'quarantine', 'water_point'].includes(typeParam)) {
    return NextResponse.json({ error: 'Missing or invalid type' }, { status: 400 });
  }

  const items = await executeDbOperation(async (db) => {
    if (typeParam === 'room') {
      const t = getTableRef('productionRooms');
      const rows = await db
        .select({ id: t.id, code: t.code, nameTh: t.nameTh, name: t.name })
        .from(t)
        .where(eq(t.isActive, true));
      return rows.map((r: { id: number; code: string; nameTh?: string | null; name?: string | null }) => ({
        id: r.id,
        name: `${r.code} — ${r.nameTh || r.name}`,
      }));
    }

    if (typeParam === 'storage_area' || typeParam === 'quarantine') {
      const t = getTableRef('warehouses');
      const rows = await db.select({ id: t.id, code: t.code, name: t.name }).from(t);
      const filtered = rows.filter((r: { id: number; code: string; name: string }) => {
        const isQuar = /qr|quar/i.test(r.code) || /quarantine/i.test(r.name);
        return typeParam === 'quarantine' ? isQuar : !isQuar;
      });
      return filtered.map((r: { id: number; code: string; name: string }) => ({ id: r.id, name: `${r.code} — ${r.name}` }));
    }

    // water_point
    const t = getTableRef('waterSamplePoints');
    const rows = await db
      .select({ id: t.id, code: t.code, name: t.name })
      .from(t)
      .where(eq(t.isActive, true));
    return rows.map((r: { id: number; code: string; name: string }) => ({ id: r.id, name: `${r.code} — ${r.name}` }));
  });

  return NextResponse.json({ items });
}
