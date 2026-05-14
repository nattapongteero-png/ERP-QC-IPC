/**
 * QC Sample Tests — per-sample test rows
 *   GET    /api/quality/qc-samples/[id]/tests          — list tests for sample
 *   POST   /api/quality/qc-samples/[id]/tests          — upsert (add or update) a test
 *   DELETE /api/quality/qc-samples/[id]/tests?testId=N — delete a single test
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  notFoundResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getQcSampleById,
  addOrUpdateTest,
  deleteTest,
} from '@/lib/services/qc-sample.service';
import { addOrUpdateTestSchema } from '@/lib/validation/qc-sample';

export async function GET(
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
      const detail = await getQcSampleById(sampleId);
      if (!detail) return notFoundResponse('QC sample not found');
      return successResponse({ tests: detail.tests });
    } catch (error) {
      console.error('Error listing tests:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const sampleId = Number(id);
      if (!Number.isFinite(sampleId)) {
        return errorResponse('Invalid sample ID');
      }
      const body = await request.json();
      // Force the path-derived sampleId to win over any payload key — prevents
      // a malicious caller from updating tests on a different sample.
      const candidate = { ...body, sampleId };
      const parsed = addOrUpdateTestSchema.safeParse(candidate);
      if (!parsed.success) {
        return errorResponse(
          'Invalid test payload',
          400,
          { errors: parsed.error.issues },
        );
      }
      const result = await addOrUpdateTest(parsed.data, session.userId);
      return successResponse(
        result,
        result.inserted ? 'Test added' : 'Test updated',
      );
    } catch (error) {
      console.error('Error upserting test:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}

export async function DELETE(
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
      const { searchParams } = new URL(request.url);
      const testIdRaw = searchParams.get('testId');
      const testId = Number(testIdRaw);
      if (!Number.isFinite(testId)) {
        return errorResponse('testId query parameter is required');
      }
      const result = await deleteTest(sampleId, testId);
      return successResponse(result, 'Test deleted');
    } catch (error) {
      console.error('Error deleting test:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
