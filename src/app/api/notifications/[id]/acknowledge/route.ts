/**
 * Acknowledge notification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { acknowledgeNotificationSchema } from '@/lib/validation/equipment-notifications';
import { acknowledgeNotification } from '@/lib/services/equipment-notification.service';
import { EquipmentNotificationError } from '@/types/equipment-notifications';

const ACK_PERMISSION = 'equipment:notifications:acknowledge';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(ACK_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const nid = Number.parseInt(id, 10);
  if (Number.isNaN(nid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = acknowledgeNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const updated = await acknowledgeNotification(nid, session.userId, parsed.data.note);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof EquipmentNotificationError) {
      const status = error.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
