/**
 * QC Sampling Plan master API (Audit QC5)
 */
import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  createSamplingPlan,
  listSamplingPlans,
  VALID_FREQUENCIES,
  type InspectionLevel,
  type SamplingFrequency,
} from '@/lib/services/qc-sampling-plan.service';

const VALID_LEVELS: InspectionLevel[] = ['I', 'II', 'III'];

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const rows = await listSamplingPlans({
        activeOnly: searchParams.get('activeOnly') === 'true',
      });
      return successResponse(rows);
    } catch (err) {
      return serverErrorResponse(err);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const data = await request.json();
      if (!data?.code || !data?.name) {
        return errorResponse('code and name are required');
      }
      if (data.inspectionLevel && !VALID_LEVELS.includes(data.inspectionLevel)) {
        return errorResponse(`inspectionLevel must be one of: ${VALID_LEVELS.join(', ')}`);
      }
      if (data.frequency && !VALID_FREQUENCIES.includes(data.frequency as SamplingFrequency)) {
        return errorResponse(`frequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
      }
      const row = await createSamplingPlan({
        code: data.code,
        name: data.name,
        itemId: data.itemId ?? null,
        category: data.category ?? null,
        inspectionLevel: data.inspectionLevel,
        aql: data.aql,
        sampleSize: data.sampleSize ?? null,
        acceptNumber: data.acceptNumber ?? null,
        rejectNumber: data.rejectNumber ?? null,
        frequency: data.frequency,
        standardRef: data.standardRef ?? null,
        defaultSampleQty: data.defaultSampleQty ?? null,
        defaultRetainQty: data.defaultRetainQty ?? null,
        notes: data.notes ?? null,
        createdBy: session.userId,
      });
      return successResponse(row, `Sampling plan ${row.code} created`);
    } catch (err) {
      return serverErrorResponse(err);
    }
  }, ['quality:write']);
}
