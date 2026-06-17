/**
 * Standard Weight — update
 * Feature: 021-scale-verification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { updateStandardWeightSchema } from '@/lib/validation/scale-verification';
import { updateStandardWeight } from '@/lib/services/scale-verification.service';
import { ScaleVerificationError } from '@/types/scale-verification';
import { dbOperations } from '@/lib/db/db-helper';

const CONFIG_PERMISSION = 'quality:scales:configure';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const wid = Number.parseInt(id, 10);
  if (Number.isNaN(wid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateStandardWeightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const updated = await updateStandardWeight(wid, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ScaleVerificationError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Delete or soft-disable — real DELETE if never used, isActive=false if referenced.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const { id } = await params;
  const wid = Number.parseInt(id, 10);
  if (Number.isNaN(wid)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  try {
    const result = await dbOperations.deleteOrDisableById('standardWeights', wid);
    return NextResponse.json({ mode: result.mode });
  } catch (error) {
    if (error instanceof ScaleVerificationError && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
