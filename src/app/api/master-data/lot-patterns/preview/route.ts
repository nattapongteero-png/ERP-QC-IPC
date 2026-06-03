/**
 * POST /api/master-data/lot-patterns/preview
 * Returns 3 sample lot numbers the supplied pattern would emit — for live UI preview.
 */
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, withAuth, serverErrorResponse } from '@/lib/api-utils';
import { previewSystemLot } from '@/lib/services/lot-pattern.service';
import { lotPatternSchema } from '@/lib/validation/lot-pattern';

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();
      const parsed = lotPatternSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const start = parsed.data.sequenceStart || 1;
      const codes = [start, start + 1, start + 2].map((n) => previewSystemLot(parsed.data, n));
      return successResponse({ codes });
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}
