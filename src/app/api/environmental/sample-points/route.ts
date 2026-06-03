/**
 * Water Sample Points CRUD
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createSamplePointSchema } from '@/lib/validation/environmental-monitoring';
import { listSamplePoints, createSamplePoint } from '@/lib/services/water-quality.service';

const PERMISSION = 'environmental:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const systemId = request.nextUrl.searchParams.get('waterSystemId');
  const items = await listSamplePoints(systemId ? Number(systemId) : undefined);
  return NextResponse.json(items);
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
  const parsed = createSamplePointSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }
  const created = await createSamplePoint(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
