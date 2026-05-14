/**
 * POST /api/quality/coa/templates/[id]/set-default — Phase 5
 *
 * Mark this template as the default for its product category. Atomically
 * unsets `is_default` on every other template at the same category level.
 * (PUT /api/quality/coa/templates/[id] with body `{ isDefault: true }` does
 *  the same thing — this endpoint exists for convenience + clearer audit
 *  log entries.)
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { setDefaultCoaTemplate } from '@/lib/services/coa.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const tplId = Number(id);
      if (!Number.isFinite(tplId)) return errorResponse('Invalid template ID');
      const result = await setDefaultCoaTemplate(tplId);
      return successResponse(result, 'Template set as default');
    } catch (error) {
      console.error('Error setting default COA template:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
