/**
 * Environmental Inspections — list + record
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { recordInspectionSchema } from '@/lib/validation/environmental-monitoring';
import { recordInspection, listSchedules } from '@/lib/services/environmental-inspection.service';
import { EnvMonitorError } from '@/types/environmental-monitoring';

const PERMISSION = 'environmental:inspect';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await listSchedules();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = recordInspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await recordInspection(parsed.data, session.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof EnvMonitorError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.code === 'NOT_FOUND' || error.code === 'TEMPLATE_NOT_FOUND' ? 404 : 409 },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
