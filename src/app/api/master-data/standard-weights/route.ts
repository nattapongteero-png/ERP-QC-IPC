/**
 * Standard Weights master CRUD
 * Feature: 021-scale-verification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createStandardWeightSchema } from '@/lib/validation/scale-verification';
import {
  listStandardWeights,
  createStandardWeight,
} from '@/lib/services/scale-verification.service';
import { ScaleVerificationError } from '@/types/scale-verification';

const CONFIG_PERMISSION = 'quality:scales:configure';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
  const items = await listStandardWeights(includeInactive);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(CONFIG_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createStandardWeightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const created = await createStandardWeight(parsed.data, session.userId);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof ScaleVerificationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === 'DUPLICATE_WEIGHT_CODE' ? 409 : 500 },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
