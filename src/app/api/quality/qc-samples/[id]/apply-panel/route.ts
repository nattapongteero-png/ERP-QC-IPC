/**
 * QC Sample — apply test panel
 *   POST /api/quality/qc-samples/[id]/apply-panel
 *   Body: { panelKey: number | string }
 *
 * Bulk-seeds qc_sample_tests rows from the matching qc_test_panels rows.
 * Skips entries already present (same criteria_id + sequence).
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { applyTestPanel } from '@/lib/services/qc-sample.service';
import { applyTestPanelSchema } from '@/lib/validation/qc-sample';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const body = await request.json();
      const parsed = applyTestPanelSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          'Invalid apply-panel payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await applyTestPanel(sampleId, parsed.data.panelKey);
      return successResponse(
        result,
        `Panel applied — ${result.added} added, ${result.skipped} already present`,
      );
    } catch (error) {
      console.error('Error applying test panel:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
