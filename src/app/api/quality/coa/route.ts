/**
 * COA Documents — collection routes
 *   GET  /api/quality/coa             — list with filters (status, productId, customerId, dateFrom, dateTo, search)
 *   POST /api/quality/coa             — generate a COA from a released QC sample
 *
 * Phase 4 — sample-based COA generation. The legacy lot-based generateCOA
 * (lib/services/quality.service.ts) remains in place for backward compat
 * but is no longer wired to this endpoint.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { generateCoaFromSample, listCoa } from '@/lib/services/coa.service';
import {
  generateCoaSchema,
  listCoaFiltersSchema,
} from '@/lib/validation/coa';

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const filtersInput: Record<string, unknown> = {};
      const status = searchParams.get('status');
      if (status) filtersInput.status = status;
      const productId = searchParams.get('productId');
      if (productId) filtersInput.productId = Number(productId);
      const customerId = searchParams.get('customerId');
      if (customerId) filtersInput.customerId = Number(customerId);
      const dateFrom = searchParams.get('dateFrom');
      if (dateFrom) filtersInput.dateFrom = dateFrom;
      const dateTo = searchParams.get('dateTo');
      if (dateTo) filtersInput.dateTo = dateTo;
      const search = searchParams.get('search');
      if (search) filtersInput.search = search;
      const page = searchParams.get('page');
      if (page) filtersInput.page = Number(page);
      const limit = searchParams.get('limit');
      if (limit) filtersInput.limit = Number(limit);

      const parsed = listCoaFiltersSchema.safeParse(filtersInput);
      if (!parsed.success) {
        return errorResponse('Invalid filter params', 400, {
          errors: parsed.error.issues,
        });
      }

      const result = await listCoa(parsed.data);
      return successResponse(result);
    } catch (error) {
      console.error('Error listing COA documents:', error);
      return serverErrorResponse(error);
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const parsed = generateCoaSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse('Invalid generate COA payload', 400, {
          errors: parsed.error.issues,
        });
      }

      const result = await generateCoaFromSample({
        sampleId: parsed.data.sampleId,
        templateId: parsed.data.templateId,
        customerId: parsed.data.customerId,
        salesOrderRef: parsed.data.salesOrderRef,
        language: parsed.data.language,
        generatedBy: session.userId,
      });

      return successResponse(result, `COA ${result.coaNumber} generated`);
    } catch (error) {
      console.error('Error generating COA:', error);
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
