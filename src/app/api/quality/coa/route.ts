import { NextRequest, NextResponse } from 'next/server';
import { withAuth, successResponse, errorResponse } from '@/lib/api-utils';
import { generateCOA, releaseLot, evaluateLotRelease } from '@/lib/services/quality.service';

// GET - Generate COA for a lot
export async function GET(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const lotId = parseInt(searchParams.get('lotId') || '0');

      if (!lotId) {
        return errorResponse('lotId is required', 400);
      }

      const coa = await generateCOA(lotId);

      return successResponse(coa);
    } catch (error) {
      console.error('COA generation error:', error);
      return errorResponse('Failed to generate COA', 500);
    }
  });
}

// POST - Release lot after QC approval
export async function POST(request: NextRequest) {
  return withAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { lotId, action } = body;

      if (!lotId) {
        return errorResponse('lotId is required', 400);
      }

      if (action === 'evaluate') {
        // Just evaluate without releasing
        const evaluation = await evaluateLotRelease(lotId, user.userId);
        return successResponse(evaluation);
      }

      // Release the lot
      await releaseLot(lotId, user.userId);
      const coa = await generateCOA(lotId);

      return successResponse({
        message: 'Lot released successfully',
        coa,
      });
    } catch (error) {
      console.error('Lot release error:', error);
      return errorResponse((error as Error).message || 'Failed to release lot', 500);
    }
  });
}
