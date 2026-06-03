/**
 * QC Sampling Plan — update / deactivate (Audit QC5)
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  deactivateSamplingPlan,
  updateSamplingPlan,
  VALID_FREQUENCIES,
  type SamplingFrequency,
} from '@/lib/services/qc-sampling-plan.service';

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
      const row = await deactivateSamplingPlan(Number(id));
      return successResponse(row, 'Sampling plan deactivated');
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['quality:write']);
}
