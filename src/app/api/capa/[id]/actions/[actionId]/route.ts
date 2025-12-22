/**
 * CAPA Action Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * PATCH /api/capa/:id/actions/:actionId - Update action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { updateAction } from '@/lib/services/capa-service';
import { capaActionUpdateSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string; actionId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:write')) {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { actionId } = await params;
    const actionIdNum = parseInt(actionId, 10);
    if (isNaN(actionIdNum)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = capaActionUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const action = await updateAction(actionIdNum, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: action,
    });
  } catch (error) {
    console.error('Error updating CAPA action:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update action' },
      { status: 500 }
    );
  }
}
