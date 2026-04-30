/**
 * QC Samples — collection routes
 *   GET  /api/quality/qc-samples       — list with filters + test counts
 *   POST /api/quality/qc-samples       — operator registers a sample
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listQcSamples,
  createQcSample,
  type ListQcSamplesFilters,
} from '@/lib/services/qc-sample.service';
import { createQcSampleSchema } from '@/lib/validation/qc-sample';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const filters: ListQcSamplesFilters = {};

      const status = searchParams.get('status');
      if (status) filters.status = status;

      const sourceType = searchParams.get('sourceType');
      if (sourceType) filters.sourceType = sourceType;

      const productId = searchParams.get('productId');
      if (productId) {
        const n = Number(productId);
        if (!Number.isFinite(n)) return errorResponse('productId must be a number');
        filters.productId = n;
      }

      const customerId = searchParams.get('customerId');
      if (customerId) {
        const n = Number(customerId);
        if (!Number.isFinite(n)) return errorResponse('customerId must be a number');
        filters.customerId = n;
      }

      const lotNumber = searchParams.get('lotNumber');
      if (lotNumber) filters.lotNumber = lotNumber;

      const dateFrom = searchParams.get('dateFrom');
      if (dateFrom) filters.dateFrom = dateFrom;

      const dateTo = searchParams.get('dateTo');
      if (dateTo) filters.dateTo = dateTo;

      const search = searchParams.get('search');
      if (search) filters.search = search;

      const page = searchParams.get('page');
      if (page) filters.page = Number(page);
      const limit = searchParams.get('limit');
      if (limit) filters.limit = Number(limit);

      const result = await listQcSamples(filters);
      return successResponse(result);
    } catch (error) {
      console.error('Error listing QC samples:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();

      // Default receivedBy to current user when omitted; matches the
      // material-return.route convention.
      const candidate = {
        ...body,
        receivedBy: body?.receivedBy ?? session.userId,
      };

      const parsed = createQcSampleSchema.safeParse(candidate);
      if (!parsed.success) {
        return errorResponse(
          'Invalid sample payload',
          400,
          { errors: parsed.error.issues },
        );
      }

      const result = await createQcSample(parsed.data);
      return successResponse(
        result,
        `Sample ${result.sampleNumber} registered (${result.testsSeeded} tests seeded)`,
      );
    } catch (error) {
      console.error('Error creating QC sample:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
