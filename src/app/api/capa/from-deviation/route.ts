/**
 * Create CAPA from Deviation API Route
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * POST /api/capa/from-deviation - Create CAPA linked to a deviation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { createFromDeviation } from '@/lib/services/capa-service';
import { capaFromDeviationSchema } from '@/lib/validation/capa';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parseResult = capaFromDeviationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { deviationId, ...capaData } = parseResult.data;
    const capa = await createFromDeviation(deviationId, capaData, session.userId);

    return NextResponse.json({
      success: true,
      data: capa,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating CAPA from deviation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create CAPA' },
      { status: 500 }
    );
  }
}
