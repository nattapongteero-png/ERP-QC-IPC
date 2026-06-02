/**
 * Material Withdrawal Requests API
 *
 * POST /api/material-withdrawal/requests — create a new request
 * GET  /api/material-withdrawal/requests — list (filterable, paginated)
 *
 * Feature: 018-material-withdrawal-approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdminRole } from '@/lib/auth';
import { getRolePermissionSet } from '@/lib/auth/permission-resolver';
import {
  createWithdrawalRequestSchema,
  withdrawalListFiltersSchema,
} from '@/lib/validation/material-withdrawal';
import {
  createRequest as createMaterialWithdrawalRequest,
  listRequests,
} from '@/lib/services/material-withdrawal.service';
import { MaterialWithdrawalError } from '@/types/material-withdrawal';

const REQUEST_PERMISSION = 'production:withdrawal:request';

async function sessionPermissions(role: string | undefined | null): Promise<Set<string>> {
  if (!role) return new Set();
  return getRolePermissionSet(role);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminRole(session.role)) {
      const perms = await sessionPermissions(session.role);
      if (!perms.has(REQUEST_PERMISSION)) {
        return NextResponse.json({ error: 'Forbidden', code: 'PERMISSION_DENIED' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createWithdrawalRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const detail = await createMaterialWithdrawalRequest(parsed.data, session.userId);
    return NextResponse.json(detail, { status: 201 });
  } catch (error) {
    if (error instanceof MaterialWithdrawalError) {
      const statusByCode: Record<string, number> = {
        DUPLICATE_SUBMISSION: 409,
        EXCEEDS_HARD_CAP: 409,
        MATERIAL_NOT_IN_BOM: 400,
        WORK_ORDER_NOT_ACTIVE: 400,
        PHASE_REQUIRED: 400,
        REASON_DETAIL_REQUIRED: 400,
        TOO_MANY_ATTACHMENTS: 400,
        ATTACHMENT_TOO_LARGE: 400,
        PERMISSION_DENIED: 403,
      };
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details ?? null },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('[material-withdrawal] POST /requests failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queryRaw: Record<string, unknown> = {};
    for (const [k, v] of searchParams.entries()) {
      queryRaw[k] = v;
    }
    const parsed = withdrawalListFiltersSchema.safeParse(queryRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid filters', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await listRequests(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[material-withdrawal] GET /requests failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
