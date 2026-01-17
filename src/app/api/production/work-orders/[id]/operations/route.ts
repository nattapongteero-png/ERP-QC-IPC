/**
 * Work Order Operations API
 * Feature: 014-unit-cost (US3 - Production Cost Aggregation)
 *
 * GET  /api/production/work-orders/[id]/operations - List operations with time tracking
 * POST /api/production/work-orders/[id]/operations - Create new operations from BOM routing
 * PUT  /api/production/work-orders/[id]/operations - Update operation time tracking
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  getWorkOrderOperations,
  createWorkOrderOperations,
  updateWorkOrderOperation,
} from '@/lib/services/unit-cost.service';
import type { WorkOrderOperationCreate, WorkOrderOperationUpdate } from '@/types/unit-cost';

// GET /api/production/work-orders/[id]/operations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const operations = await getWorkOrderOperations(workOrderId);

      return successResponse(operations);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders/[id]/operations - Create operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { operations } = body as { operations: Omit<WorkOrderOperationCreate, 'workOrderId'>[] };

      if (!operations || !Array.isArray(operations) || operations.length === 0) {
        return errorResponse('Operations array is required');
      }

      // Add workOrderId to each operation
      const operationsWithWoId: WorkOrderOperationCreate[] = operations.map(op => ({
        ...op,
        workOrderId,
      }));

      const ids = await createWorkOrderOperations(operationsWithWoId);

      return successResponse({ ids }, 'Operations created successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}

// PUT /api/production/work-orders/[id]/operations - Update operation time tracking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { operationId, ...updateData } = body as { operationId: number } & WorkOrderOperationUpdate;

      if (!operationId) {
        return errorResponse('Operation ID is required');
      }

      await updateWorkOrderOperation(operationId, updateData);

      return successResponse(null, 'Operation updated successfully');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
