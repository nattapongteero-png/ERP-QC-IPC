/**
 * Overhead Rates API
 * Feature: 014-unit-cost (US6 - Work Center Configuration)
 *
 * GET /api/cost/overhead-rates - List overhead rates
 * POST /api/cost/overhead-rates - Create a new overhead rate
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listOverheadRates, createOverheadRate } from '@/lib/services/unit-cost.service';
import { overheadRateCreateSchema } from '@/lib/validation/unit-cost';

// GET /api/cost/overhead-rates
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const url = new URL(request.url);
      const workCenterId = url.searchParams.get('workCenterId');
      const isActive = url.searchParams.get('isActive');
      const effectiveDate = url.searchParams.get('effectiveDate');

      const result = await listOverheadRates({
        workCenterId: workCenterId ? parseInt(workCenterId) : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        effectiveDate: effectiveDate || undefined,
      });

      return successResponse(result);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['cost:read']);
}

// POST /api/cost/overhead-rates
export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();
      const parseResult = overheadRateCreateSchema.safeParse(body);

      if (!parseResult.success) {
        const errors = parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        return errorResponse('Validation failed', 400, { errors });
      }

      const result = await createOverheadRate(parseResult.data);
      return successResponse(result, 'Overhead rate created successfully');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return errorResponse(error.message, 400);
      }
      return serverErrorResponse(error);
    }
  }, ['cost:write']);
}
