import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;

      const workOrders = getTableRef('workOrders');
      const workOrderMaterials = getTableRef('workOrderMaterials');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');
      const qualityTests = getTableRef('qualityTests');

      // Get work order details
      const woResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrders.id,
            woNumber: workOrders.woNumber,
            productId: workOrders.productId,
            productCode: items.code,
            productName: items.nameTh,
            productNameEn: items.nameEn,
            productUnit: items.primaryUnit,
            batchNumber: workOrders.batchNumber,
            plannedQuantity: workOrders.plannedQuantity,
            actualQuantity: workOrders.actualQuantity,
            rejectQuantity: workOrders.rejectQuantity,
            unit: workOrders.unit,
            status: workOrders.status,
            priority: workOrders.priority,
            plannedStartDate: workOrders.plannedStartDate,
            plannedEndDate: workOrders.plannedEndDate,
            actualStartDate: workOrders.actualStartDate,
            actualEndDate: workOrders.actualEndDate,
            deliveryDate: workOrders.deliveryDate,
            yieldPercentage: workOrders.yieldPercentage,
            notes: workOrders.notes,
            createdAt: workOrders.createdAt,
            updatedAt: workOrders.updatedAt,
          })
          .from(workOrders)
          .leftJoin(items, eq(workOrders.productId, items.id))
          .where(eq(workOrders.id, parseInt(id)));
      });

      if (woResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }

      const workOrder = woResult[0];

      // Get work order materials
      const materialsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrderMaterials.id,
            itemId: workOrderMaterials.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemUnit: items.primaryUnit,
            plannedQuantity: workOrderMaterials.plannedQuantity,
            actualQuantity: workOrderMaterials.actualQuantity,
            unit: workOrderMaterials.unit,
            status: workOrderMaterials.status,
            lotId: workOrderMaterials.lotId,
          })
          .from(workOrderMaterials)
          .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
          .where(eq(workOrderMaterials.workOrderId, parseInt(id)));
      });

      // Get lot information for each material
      const materialsWithLots = await Promise.all(
        materialsResult.map(async (material: Record<string, unknown>) => {
          if (material.lotId) {
            const lotResult = await executeDbOperation(async (db) => {
              return db
                .select({
                  lotNumber: inventoryLots.lotNumber,
                  expiryDate: inventoryLots.expiryDate,
                })
                .from(inventoryLots)
                .where(eq(inventoryLots.id, material.lotId as number));
            });
            return {
              ...material,
              lotNumber: lotResult[0]?.lotNumber || null,
              lotExpiryDate: lotResult[0]?.expiryDate || null,
            };
          }
          return { ...material, lotNumber: null, lotExpiryDate: null };
        })
      );

      // Get QC tests for lots associated with this work order
      const qcTestsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: qualityTests.id,
            lotId: qualityTests.lotId,
            testType: qualityTests.testType,
            status: qualityTests.status,
            result: qualityTests.result,
            testDate: qualityTests.testDate,
          })
          .from(qualityTests);
      });

      // Filter QC tests related to this work order's lots
      const relatedLotIds = materialsWithLots
        .filter((m: Record<string, unknown>) => m.lotId)
        .map((m: Record<string, unknown>) => m.lotId);
      const relatedQcTests = qcTestsResult.filter((t: Record<string, unknown>) => relatedLotIds.includes(t.lotId));

      // Calculate yield
      const yieldPercent = workOrder.plannedQuantity && workOrder.actualQuantity
        ? Math.round(((workOrder.actualQuantity as number) / (workOrder.plannedQuantity as number)) * 100 * 100) / 100
        : workOrder.yieldPercentage || null;

      // Calculate material consumption
      // Map field names for UI compatibility (UI expects plannedQty/actualQty)
      const materialConsumption = materialsWithLots.map((material: Record<string, unknown>) => ({
        ...material,
        plannedQty: material.plannedQuantity,
        actualQty: material.actualQuantity,
        consumptionPercent: material.plannedQuantity && material.actualQuantity
          ? Math.round(((material.actualQuantity as number) / (material.plannedQuantity as number)) * 100 * 100) / 100
          : null,
        variance: material.plannedQuantity && material.actualQuantity
          ? (material.actualQuantity as number) - (material.plannedQuantity as number)
          : null,
      }));

      // Calculate production time
      let productionTimeHours = null;
      if (workOrder.actualStartDate && workOrder.actualEndDate) {
        const start = new Date(workOrder.actualStartDate as string);
        const end = new Date(workOrder.actualEndDate as string);
        productionTimeHours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
      }

      // eBMR (Electronic Batch Manufacturing Record) summary
      const ebmr = {
        batchNumber: workOrder.batchNumber,
        productCode: workOrder.productCode,
        productName: workOrder.productName,
        plannedQuantity: workOrder.plannedQuantity,
        actualQuantity: workOrder.actualQuantity,
        yieldPercent,
        productionTimeHours,
        status: workOrder.status,
        materials: materialConsumption,
        qcTests: relatedQcTests,
        timeline: {
          plannedStart: workOrder.plannedStartDate,
          plannedEnd: workOrder.plannedEndDate,
          actualStart: workOrder.actualStartDate,
          actualEnd: workOrder.actualEndDate,
        },
      };

      return NextResponse.json({
        success: true,
        data: {
          workOrder,
          materials: materialConsumption,
          qcTests: relatedQcTests,
          ebmr,
          summary: {
            yieldPercent,
            productionTimeHours,
            materialCount: materialsWithLots.length,
            qcTestCount: relatedQcTests.length,
            qcPassCount: relatedQcTests.filter((t: Record<string, unknown>) => t.status === 'pass').length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching work order details:', error);
      return serverErrorResponse(error);
    }
  });
}
