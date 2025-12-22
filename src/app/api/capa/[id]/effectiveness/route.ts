/**
 * CAPA Effectiveness API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * POST /api/capa/:id/effectiveness - Record effectiveness check
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { recordEffectiveness } from '@/lib/services/capa-service';
import { capaEffectivenessCreateSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string }>;
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

    const { id } = await params;
    const capaId = parseInt(id, 10);
    if (isNaN(capaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CAPA ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = capaEffectivenessCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const effectiveness = await recordEffectiveness(capaId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: effectiveness,
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording effectiveness:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to record effectiveness' },
      { status: 500 }
    );
  }
}
