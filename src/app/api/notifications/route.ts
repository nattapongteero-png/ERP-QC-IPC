/**
 * Equipment Notifications API — list + count
 * Feature: 022-equipment-notifications
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listNotifications } from '@/lib/services/equipment-notification.service';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const result = await listNotifications({
    status: (sp.get('status') as any) ?? undefined,
    severity: (sp.get('severity') as any) ?? undefined,
    type: (sp.get('type') as any) ?? undefined,
    page: sp.get('page') ? Number(sp.get('page')) : undefined,
    pageSize: sp.get('pageSize') ? Number(sp.get('pageSize')) : undefined,
  });
  return NextResponse.json(result);
}
