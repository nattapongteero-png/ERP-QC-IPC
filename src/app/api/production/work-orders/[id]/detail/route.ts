import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import { 
  sqliteWorkOrders, sqliteWorkOrderMaterials, sqliteItems, sqliteInventoryLots, sqliteUsers, sqliteQualityTests,
  mysqlWorkOrders, mysqlWorkOrderMaterials, mysqlItems, mysqlInventoryLots, mysqlUsers, mysqlQualityTests
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const workOrders = isSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
      const workOrderMaterials = isSqlite() ? sqliteWorkOrderMaterials : mysqlWorkOrderMaterials;
      const items = isSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const users = isSqlite() ? sqliteUsers : mysqlUsers;
      const qualityTests = isSqlite() ? sqliteQualityTests : mysqlQualityTests;

      // Get work order details
      const woResult = await (db as any)
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
          unit: workOrders.unit,
          status: workOrders.status,
          priority: workOrders.priority,
          plannedStartDate: workOrders.plannedStartDate,
          plannedEndDate: workOrders.plannedEndDate,
          actualStartDate: workOrders.actualStartDate,
          actualEndDate: workOrders.actualEndDate,
          yieldPercentage: workOrders.yieldPercentage,
          notes: workOrders.notes,
          createdAt: workOrders.createdAt,
          updatedAt: workOrders.updatedAt,
        })
        .from(workOrders)
        .leftJoin(items, eq(workOrders.productId, items.id))
        .where(eq(workOrders.id, parseInt(id)));

      if (woResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Work order not found' }, { status: 404 });
      }

      const workOrder = woResult[0];

      // Get work order materials
      const materialsResult = await (db as any)
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

      // Get lot information for each material
      const materialsWithLots = await Promise.all(
        materialsResult.map(async (material: any) => {
          if (material.lotId) {
            const lotResult = await (db as any)
              .select({
                lotNumber: inventoryLots.lotNumber,
                expiryDate: inventoryLots.expiryDate,
              })
              .from(inventoryLots)
              .where(eq(inventoryLots.id, material.lotId));
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
      const qcTestsResult = await (db as any)
        .select({
          id: qualityTests.id,
          lotId: qualityTests.lotId,
          testType: qualityTests.testType,
          status: qualityTests.status,
          result: qualityTests.result,
          testDate: qualityTests.testDate,
        })
        .from(qualityTests);

      // Filter QC tests related to this work order's lots
      const relatedLotIds = materialsWithLots
        .filter((m: any) => m.lotId)
        .map((m: any) => m.lotId);
      const relatedQcTests = qcTestsResult.filter((t: any) => relatedLotIds.includes(t.lotId));

      // Calculate yield
      const yieldPercent = workOrder.plannedQuantity && workOrder.actualQuantity
        ? Math.round((workOrder.actualQuantity / workOrder.plannedQuantity) * 100 * 100) / 100
        : workOrder.yieldPercentage || null;

      // Calculate material consumption
      const materialConsumption = materialsWithLots.map((material: any) => ({
        ...material,
        consumptionPercent: material.plannedQuantity && material.actualQuantity
          ? Math.round((material.actualQuantity / material.plannedQuantity) * 100 * 100) / 100
          : null,
        variance: material.plannedQuantity && material.actualQuantity
          ? material.actualQuantity - material.plannedQuantity
          : null,
      }));

      // Calculate production time
      let productionTimeHours = null;
      if (workOrder.actualStartDate && workOrder.actualEndDate) {
        const start = new Date(workOrder.actualStartDate);
        const end = new Date(workOrder.actualEndDate);
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
            qcPassCount: relatedQcTests.filter((t: any) => t.status === 'pass').length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching work order details:', error);
      return serverErrorResponse(error);
    }
  });
}
