/**
 * POST /api/master-data/item-code-patterns/preview
 * Body: { itemType, prefix, separator, padding, includeYear, yearFormat, yearPosition, sequenceStart }
 * Returns: { codes: string[] } — first 3 codes the pattern would emit, for live preview.
 */
import { NextRequest } from 'next/server';
import { successResponse, errorResponse, withAuth, serverErrorResponse } from '@/lib/api-utils';
import { previewCode } from '@/lib/services/item-code-pattern.service';
import { itemCodePatternSchema } from '@/lib/validation/item-code-pattern';

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const data = await request.json();
      const parsed = itemCodePatternSchema.safeParse(data);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues.map((i) => i.message).join('; '));
      }
      const start = parsed.data.sequenceStart || 1;
      const codes = [start, start + 1, start + 2].map((n) => previewCode(parsed.data, n));
      return successResponse({ codes });
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}
