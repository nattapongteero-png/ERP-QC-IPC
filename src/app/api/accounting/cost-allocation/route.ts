// Cost Allocation API
// Feature: 010-accounting-module-integration
// User Story 4: Process Manufacturing Cost Accounting

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import {
  recordMaterialCost,
  allocateLaborCost,
  allocateOverhead,
  transferToFinishedGoods,
} from '@/lib/services/accounting.service';
import { costAllocationInputSchema } from '@/lib/validation/accounting';

// POST /api/accounting/cost-allocation - Allocate costs to work order
export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (session) => {
      try {
        const body = await request.json();

        // Validate input using discriminated union
        const parseResult = costAllocationInputSchema.safeParse(body);
        if (!parseResult.success) {
          const errors = parseResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          }));
          return errorResponse('Validation failed', 400, { errors });
        }

        const { allocationType, data } = parseResult.data;
        let result;

        switch (allocationType) {
          case 'material':
            result = await recordMaterialCost(
              {
                workOrderId: data.workOrderId,
                batchNumber: data.batchNumber,
                materialItemId: data.materialItemId,
                lotId: data.lotId ?? undefined,
                quantity: data.quantity,
                unitCost: data.unitCost,
                issueDate: data.issueDate,
                description: data.description ?? undefined,
              },
              session.userId
            );
            break;

          case 'labor':
            result = await allocateLaborCost(
              {
                workOrderId: data.workOrderId,
                batchNumber: data.batchNumber,
                laborHours: data.laborHours,
                hourlyRate: data.hourlyRate,
                allocationDate: data.allocationDate,
                description: data.description ?? undefined,
                costCenterId: data.costCenterId ?? undefined,
              },
              session.userId
            );
            break;

          case 'overhead':
            result = await allocateOverhead(
              {
                workOrderId: data.workOrderId,
                batchNumber: data.batchNumber,
                overheadType: data.overheadType,
                allocationBasis: data.allocationBasis,
                basisAmount: data.basisAmount,
                overheadRate: data.overheadRate,
                allocationDate: data.allocationDate,
                description: data.description ?? undefined,
              },
              session.userId
            );
            break;

          case 'transfer':
            result = await transferToFinishedGoods(
              {
                workOrderId: data.workOrderId,
                batchNumber: data.batchNumber,
                finishedGoodsItemId: data.finishedGoodsItemId,
                producedQuantity: data.producedQuantity,
                transferDate: data.transferDate,
                description: data.description ?? undefined,
                lotId: data.lotId ?? undefined,
              },
              session.userId
            );
            break;

          default:
            return errorResponse('Invalid allocation type', 400);
        }

        return successResponse(result, `${allocationType} cost allocated successfully`);
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes('not found') ||
            error.message.includes('does not exist')
          ) {
            return errorResponse(error.message, 404);
          }
          if (error.message.includes('already')) {
            return errorResponse(error.message, 400);
          }
        }
        return serverErrorResponse(error);
      }
    },
    ['accounting:cost_allocation:write']
  );
}
