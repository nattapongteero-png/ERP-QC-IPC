/**
 * QC Sampling Plan — update / delete-or-disable (Audit QC5)
 *
 * DELETE: tries hard-delete; if the row is referenced (FK violation) it falls
 * back to isActive=false and returns { mode: 'disabled' }.
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  updateSamplingPlan,
  VALID_FREQUENCIES,
  type SamplingFrequency,
} from '@/lib/services/qc-sampling-plan.service';
import { dbOperations } from '@/lib/db/db-helper';
import { getNow } from '@/lib/db/date-utils';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const data = await request.json();
      if (data.frequency && !VALID_FREQUENCIES.includes(data.frequency as SamplingFrequency)) {
        return errorResponse(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
      }
      const row = await updateSamplingPlan(Number(id), data);
      return successResponse(row, 'Sampling plan updated');
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['quality:write']);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(_request, async () => {
    try {
      const { id } = await params;
      const result = await dbOperations.deleteOrDisableById(
        'qcSamplingPlans',
        Number(id),
        { updatedAt: getNow() },
      );
      return successResponse({ mode: result.mode }, result.mode === 'deleted' ? 'Sampling plan deleted' : 'Sampling plan disabled');
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['quality:write']);
}
