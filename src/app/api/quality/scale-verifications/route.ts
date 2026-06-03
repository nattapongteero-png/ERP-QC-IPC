/**
 * Scale Verifications collection — GET (list scales + current state), POST (record)
 * Feature: 021-scale-verification
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import { createVerificationSchema } from '@/lib/validation/scale-verification';
import {
  createVerification,
  getScalesNeedingVerification,
} from '@/lib/services/scale-verification.service';
import { ScaleVerificationError } from '@/types/scale-verification';

const VERIFY_PERMISSION = 'quality:scales:verify';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await getScalesNeedingVerification();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isAdminRole(session.role ?? '')) {
    const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
    if (!perms.has(VERIFY_PERMISSION)) {
      return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const verification = await createVerification(parsed.data, session.userId);
    return NextResponse.json(verification, { status: 201 });
  } catch (error) {
    if (error instanceof ScaleVerificationError) {
      const status =
        error.code === 'SCALE_NOT_FOUND' || error.code === 'STANDARD_WEIGHT_NOT_FOUND'
          ? 404
          : 409;
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status },
      );
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
