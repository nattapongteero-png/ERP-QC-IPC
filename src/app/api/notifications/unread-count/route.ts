/**
 * Unread count for bell icon
 */
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUnreadCount } from '@/lib/services/equipment-notification.service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ count: 0 }, { status: 401 });
  const count = await getUnreadCount();
  return NextResponse.json({ count });
}
