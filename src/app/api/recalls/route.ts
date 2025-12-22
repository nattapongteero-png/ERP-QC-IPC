/**
 * Recalls API Routes
 * Feature: 009-gmp-compliance-gap-analysis (หมวด 9)
 *
 * GET /api/recalls - List recalls with filtering
 * POST /api/recalls - Create new recall
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listRecalls, createRecall } from '@/lib/services/recall-service';
import { recallCreateSchema, recallListParamsSchema } from '@/lib/validation/recalls';

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
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

        return successResponse(result);
      } catch (error) {
        console.error('Error listing recalls:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:read']
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();
        const validatedData = recallCreateSchema.parse(body);

        const recall = await createRecall(validatedData, session.userId);

        return NextResponse.json({ success: true, data: recall }, { status: 201 });
      } catch (error) {
        console.error('Error creating recall:', error);
        return serverErrorResponse(error);
      }
    },
    ['recalls:write']
  );
}
