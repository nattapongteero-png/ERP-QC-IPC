/**
 * Matching Tolerance Detail API (T109)
 * GET /api/settings/matching-tolerances/[id]
 * PUT /api/settings/matching-tolerances/[id]
 * DELETE /api/settings/matching-tolerances/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import {
  getToleranceById,
  updateTolerance,
  deleteTolerance,
} from '@/lib/services/matching.service';
import { toleranceUpdateSchema } from '@/lib/validation/matching';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const toleranceId = parseInt(id, 10);

      if (isNaN(toleranceId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid tolerance ID' },
          { status: 400 }
        );
      }

      const tolerance = await getToleranceById(toleranceId);
      if (!tolerance) {
        return NextResponse.json(
          { success: false, error: 'Tolerance not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: tolerance });
    } catch (error) {
      console.error('Error getting tolerance:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const toleranceId = parseInt(id, 10);

      if (isNaN(toleranceId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid tolerance ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = toleranceUpdateSchema.parse(body);

      const result = await updateTolerance(toleranceId, data);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating tolerance:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await context.params;
      const toleranceId = parseInt(id, 10);

      if (isNaN(toleranceId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid tolerance ID' },
          { status: 400 }
        );
      }

      const result = await deleteTolerance(toleranceId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting tolerance:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}
