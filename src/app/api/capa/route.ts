/**
 * CAPA API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 1)
 *
 * GET /api/capa - List CAPAs with filtering and pagination
 * POST /api/capa - Create a new CAPA
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listCapas, createCapa } from '@/lib/services/capa-service';
import { capaListParamsSchema, capaCreateSchema } from '@/lib/validation/capa';

export async function GET(request: NextRequest) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      priority: searchParams.get('priority') || undefined,
      sourceType: searchParams.get('sourceType') || undefined,
      ownerId: searchParams.get('ownerId') || undefined,
      overdue: searchParams.get('overdue') || undefined,
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };

    // Validate parameters
    const parseResult = capaListParamsSchema.safeParse(params);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const result = await listCapas(parseResult.data);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing CAPAs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list CAPAs',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

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
    const parseResult = capaCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const capa = await createCapa(parseResult.data, session.userId);

    return NextResponse.json({
      success: true,
      data: capa,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating CAPA:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create CAPA' },
      { status: 500 }
    );
  }
}
