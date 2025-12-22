/**
 * Verify CAPA Action API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * POST /api/capa/:id/actions/:actionId/verify - Verify a completed action
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { verifyAction } from '@/lib/services/capa-service';

interface RouteParams {
  params: Promise<{ id: string; actionId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const action = await verifyAction(actionIdNum, session.userId);

    return NextResponse.json({
      success: true,
      data: action,
    });
  } catch (error) {
    console.error('Error verifying CAPA action:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to verify action' },
      { status: 500 }
    );
  }
}
