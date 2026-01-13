import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { executeDbOperation, getTableRef } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';

// GET /api/production/work-orders/[id]/packaging-qc-criteria - Get BOM packaging QC criteria
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const workOrderId = Number(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      // Get tables
      const workOrders = getTableRef('workOrders');
      const bomPackagingQC = getTableRef('bomPackagingQC');
      const packagingQCCriteria = getTableRef('packagingQCCriteria');

      // Get work order's BOM ID
      const workOrder = await executeDbOperation(async (db) => {
        const result = await db
          .select({ bomId: workOrders.bomId })
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
        return result[0];
      });

      if (!workOrder) {
        return errorResponse('Work order not found', 404);
      }

      if (!workOrder.bomId) {
        return successResponse(null, 'No BOM linked to this work order');
      }

      // Get BOM packaging QC criteria
      const criteria = await executeDbOperation(async (db) => {
        const result = await db
          .select({
            id: bomPackagingQC.id,
            bomId: bomPackagingQC.bomId,
            criteriaId: bomPackagingQC.criteriaId,
            // Criteria details
            code: packagingQCCriteria.code,
            name: packagingQCCriteria.name,
            weightMin: packagingQCCriteria.weightMin,
            weightMax: packagingQCCriteria.weightMax,
            sampleSize: packagingQCCriteria.sampleSize,
            maxFailures: packagingQCCriteria.maxFailures,
            checkIntervalMinutes: packagingQCCriteria.checkIntervalMinutes,
          })
          .from(bomPackagingQC)
          .innerJoin(
            packagingQCCriteria,
            eq(bomPackagingQC.criteriaId, packagingQCCriteria.id)
          )
          .where(eq(bomPackagingQC.bomId, workOrder.bomId));
        return result[0];
      });

      if (!criteria) {
        return successResponse(null, 'No packaging QC criteria configured for this BOM');
      }

      return successResponse(criteria);
    } catch (error) {
      console.error('Error fetching packaging QC criteria:', error);
      return serverErrorResponse(error);
    }
  });
}
