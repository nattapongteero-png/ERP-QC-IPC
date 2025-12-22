/**
 * Recalls API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls - List recalls with filtering
 * POST /api/recalls - Create new recall
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasPermission } from '@/lib/auth';
import { listRecalls, createRecall } from '@/lib/services/recall-service';
import { recallCreateSchema, recallListParamsSchema } from '@/lib/validation/recalls';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:read')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const params = {
      status: searchParams.get('status') || undefined,
      recallClass: searchParams.get('recallClass') || undefined,
      productId: searchParams.get('productId') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    };

    const validatedParams = recallListParamsSchema.parse(params);
    const result = await listRecalls(validatedParams);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error listing recalls:', error);
    const message = error instanceof Error ? error.message : 'Failed to list recalls';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.role as any, 'recalls:write')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = recallCreateSchema.parse(body);

    const recall = await createRecall(validatedData, sessionId);

    return NextResponse.json({ success: true, data: recall }, { status: 201 });
  } catch (error) {
    console.error('Error creating recall:', error);
    const message = error instanceof Error ? error.message : 'Failed to create recall';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
