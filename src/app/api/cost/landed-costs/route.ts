/**
 * API Route: /api/cost/landed-costs
 * GET - List landed costs with filters
 * POST - Create new landed cost
 * Feature: 014-unit-cost
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { listLandedCosts, createLandedCost } from '@/lib/services/unit-cost.service';
import { landedCostCreateSchema, landedCostListFiltersSchema } from '@/lib/validation/unit-cost';

// GET /api/cost/landed-costs - List landed costs with pagination and filters
export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      try {
        const { searchParams } = new URL(request.url);
        const parseResult = landedCostListFiltersSchema.safeParse(
          Object.fromEntries(searchParams.entries())
        );

        const filters = parseResult.success ? parseResult.data : {};
        const result = await listLandedCosts(filters);

        return successResponse(result);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['cost:read']
  );
}

// POST /api/cost/landed-costs - Create new landed cost
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input
        const parseResult = landedCostCreateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const result = await createLandedCost(parseResult.data, session.userId);
        return successResponse(result, 'Landed cost created successfully');
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['cost:write']
  );
}
