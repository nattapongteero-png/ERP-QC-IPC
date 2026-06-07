/**
 * Environmental Inspection Record — view / edit (correction) / delete
 *
 * Edits and deletes of a signed GMP record are written to the audit trail.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import {
  getInspectionRecord,
  updateInspectionRecord,
  deleteInspectionRecord,
} from '@/lib/services/environmental-inspection.service';
import { EnvMonitorError } from '@/types/environmental-monitoring';

const PERMISSION = 'environmental:inspect';

async function requireWrite(session: { role?: string | null }) {
  if (isAdminRole(session.role ?? '')) return true;
  const perms = session.role ? await getRolePermissionSet(session.role) : new Set<string>();
  return perms.has(PERMISSION);
}

function statusFor(err: EnvMonitorError) {
  return err.code === 'NOT_FOUND' || err.code === 'TEMPLATE_NOT_FOUND' ? 404 : 409;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const record = await getInspectionRecord(Number(id));
    return NextResponse.json(record);
  } catch (error) {
    if (error instanceof EnvMonitorError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error) });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await requireWrite(session))) {
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!Array.isArray(body?.results)) {
    return NextResponse.json({ error: 'results array is required' }, { status: 400 });
  }

  try {
    const result = await updateInspectionRecord(
      Number(id),
      {
        notes: body.notes,
        results: body.results.map((r: any) => ({
          id: Number(r.id),
          numericValue:
            r.numericValue !== undefined
              ? r.numericValue === null || r.numericValue === ''
                ? null
                : Number(r.numericValue)
              : undefined,
          remarks: r.remarks,
        })),
      },
      session.userId,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EnvMonitorError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error) });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await requireWrite(session))) {
    return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const result = await deleteInspectionRecord(Number(id), session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EnvMonitorError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusFor(error) });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
