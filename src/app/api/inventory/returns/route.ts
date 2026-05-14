/**
 * Material Returns — collection routes
 *   GET  /api/inventory/returns       — list with filters + line aggregates
 *   POST /api/inventory/returns       — operator submits a return event
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  listMaterialReturns,
  submitMaterialReturn,
  type ListMaterialReturnsFilters,
} from '@/lib/services/material-return.service';
import { submitMaterialReturnSchema } from '@/lib/validation/material-return';

// GET — list returns. Filters: workOrderId, status, dateFrom, dateTo, warehouseId.
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      const filters: ListMaterialReturnsFilters = {};
      const wo = searchParams.get('workOrderId');
      if (wo) {
        const n = Number(wo);
        if (!Number.isFinite(n)) return errorResponse('workOrderId must be a number');
        filters.workOrderId = n;
      }
      const status = searchParams.get('status');
      if (status) filters.status = status;
      const wh = searchParams.get('warehouseId');
      if (wh) {
        const n = Number(wh);
        if (!Number.isFinite(n)) return errorResponse('warehouseId must be a number');
        filters.warehouseId = n;
      }
      const dateFrom = searchParams.get('dateFrom');
      if (dateFrom) filters.dateFrom = dateFrom;
      const dateTo = searchParams.get('dateTo');
      if (dateTo) filters.dateTo = dateTo;

      const page = searchParams.get('page');
      if (page) filters.page = Number(page);
      const limit = searchParams.get('limit');
      if (limit) filters.limit = Number(limit);

      const result = await listMaterialReturns(filters);
      return successResponse(result);
    } catch (error) {
      console.error('Error listing material returns:', error);
      return serverErrorResponse(error);
    }
  });
}

// POST — submit a return. Body matches submitMaterialReturnSchema.
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();

      // Default operatorId to the session user when the client omits it; this
      // matches the convention used by the SOP execution endpoint.
      const candidate = {
        ...body,
        operatorId: body?.operatorId ?? session.userId,
      };

      const parsed = submitMaterialReturnSchema.safeParse(candidate);
      if (!parsed.success) {
        return errorResponse(
          'Invalid material return payload',
          400,
          { errors: parsed.error.issues },
        );
      }

      const result = await submitMaterialReturn(parsed.data);
      return successResponse(
        result,
        `Return ${result.returnNumber} submitted (${result.lineIds.length} lines, ${result.outsideToleranceCount} outside tolerance)`,
      );
    } catch (error) {
      console.error('Error submitting material return:', error);
      // Surface Thai/English business-rule errors to the operator with a 400
      // so the client can show them inline rather than a generic 500.
      if (error instanceof Error && error.message) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  });
}
