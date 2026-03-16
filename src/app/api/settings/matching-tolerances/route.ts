/**
 * Matching Tolerances API (T108)
 * GET /api/settings/matching-tolerances - List tolerances
 * POST /api/settings/matching-tolerances - Create tolerance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-utils';
import { createTolerance, listTolerances } from '@/lib/services/matching.service';
import { toleranceCreateSchema, toleranceListFilterSchema } from '@/lib/validation/matching';

export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const { searchParams } = new URL(request.url);
      // Convert null to undefined for optional fields
      const filter = toleranceListFilterSchema.parse({
        toleranceType: searchParams.get('toleranceType') || undefined,
        isActive: searchParams.get('isActive') || undefined,
        search: searchParams.get('search') || undefined,
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || undefined,
      });

      const result = await listTolerances(filter);
      return NextResponse.json({ success: true, ...result });
    } catch (error) {
      console.error('Error listing tolerances:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }

  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const data = toleranceCreateSchema.parse(body);

      // TODO: Get actual user ID from session
      const userId = session.userId;

      const id = await createTolerance(data, userId);
      return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error) {
      console.error('Error creating tolerance:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 400 }
      );
    }

  });
}
