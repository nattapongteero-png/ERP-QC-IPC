/**
 * CAPA Detail API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/capa/:id - Get CAPA details
 * PATCH /api/capa/:id - Update CAPA
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { getCapaDetails, updateCapa } from '@/lib/services/capa-service';
import { capaUpdateSchema } from '@/lib/validation/capa';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasPermission(session.role as Parameters<typeof hasPermission>[0], 'capa:read')) {
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

    const capa = await getCapaDetails(capaId);
    if (!capa) {
      return NextResponse.json(
        { success: false, error: 'CAPA not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: capa,
    });
  } catch (error) {
    console.error('Error fetching CAPA:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch CAPA' },
      { status: 500 }
    );
  }
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

    const { id } = await params;
    const capaId = parseInt(id, 10);
    if (isNaN(capaId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CAPA ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parseResult = capaUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const capa = await updateCapa(capaId, parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: capa,
    });
  } catch (error) {
    console.error('Error updating CAPA:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update CAPA' },
      { status: 500 }
    );
  }
}
