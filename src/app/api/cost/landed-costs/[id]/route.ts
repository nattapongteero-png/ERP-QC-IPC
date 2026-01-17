/**
 * API Route: /api/cost/landed-costs/[id]
 * GET - Get single landed cost with lines and allocations
 * PUT - Update landed cost (draft only)
 * DELETE - Delete landed cost (draft only)
 * Feature: 014-unit-cost
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getLandedCost,
  updateLandedCost,
  deleteLandedCost,
} from '@/lib/services/unit-cost.service';
import { landedCostUpdateSchema } from '@/lib/validation/unit-cost';

// GET /api/cost/landed-costs/[id] - Get single landed cost with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const landedCostId = parseInt(id, 10);

        if (isNaN(landedCostId)) {
          return errorResponse('Invalid landed cost ID', 400);
        }

        const landedCost = await getLandedCost(landedCostId);

        if (!landedCost) {
          return errorResponse('Landed cost not found', 404);
        }

        return successResponse(landedCost);
      } catch (error) {
        return serverErrorResponse(error);
      }
    },
    ['cost:read']
  );
}

// PUT /api/cost/landed-costs/[id] - Update landed cost
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const landedCostId = parseInt(id, 10);

        if (isNaN(landedCostId)) {
          return errorResponse('Invalid landed cost ID', 400);
        }

        const body = await request.json();

        // Validate input
        const parseResult = landedCostUpdateSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        await updateLandedCost(landedCostId, parseResult.data);
        return successResponse({ id: landedCostId }, 'Landed cost updated successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('not in draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['cost:write']
  );
}

// DELETE /api/cost/landed-costs/[id] - Delete landed cost
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(
    request,
    async () => {
      try {
        const { id } = await params;
        const landedCostId = parseInt(id, 10);

        if (isNaN(landedCostId)) {
          return errorResponse('Invalid landed cost ID', 400);
        }

        await deleteLandedCost(landedCostId);
        return successResponse({ id: landedCostId }, 'Landed cost deleted successfully');
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('not in draft')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['cost:write']
  );
}
