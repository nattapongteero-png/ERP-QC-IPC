import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
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
      const workOrders = useSqlite() ? sqliteWorkOrders : mysqlWorkOrders;
      const workOrderLines = useSqlite() ? sqliteWorkOrderMaterials : mysqlWorkOrderMaterials;
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const users = useSqlite() ? sqliteUsers : mysqlUsers;
      const qualityTests = useSqlite() ? sqliteQualityTests : mysqlQualityTests;

      // Get work order details
      const woResult = await db
        .select({
          id: workOrders.id,
          woNumber: workOrders.woNumber,
          productId: workOrders.productId,
          productCode: items.code,
          productName: items.nameTh,
          productNameEn: items.nameEn,
          productUnit: items.unit,
          batchNumber: workOrders.batchNumber,
          plannedQty: workOrders.plannedQty,
          actualQty: workOrders.actualQty,
          status: workOrders.status,
          plannedStartDate: workOrders.plannedStartDate,
          plannedEndDate: workOrders.plannedEndDate,
          actualStartDate: workOrders.actualStartDate,
          actualEndDate: workOrders.actualEndDate,
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

      // Get work order lines (materials)
      const linesResult = await db
        .select({
          id: workOrderLines.id,
          itemId: workOrderLines.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          itemNameEn: items.nameEn,
          itemUnit: items.unit,
          plannedQty: workOrderLines.plannedQty,
          actualQty: workOrderLines.actualQty,
          lotId: workOrderLines.lotId,
        })
        .from(workOrderLines)
        .leftJoin(items, eq(workOrderLines.itemId, items.id))
        .where(eq(workOrderLines.woId, parseInt(id)));

      // Get lot information for each line
      const linesWithLots = await Promise.all(
        linesResult.map(async (line: any) => {
          if (line.lotId) {
            const lotResult = await db
              .select({
                lotNumber: inventoryLots.lotNumber,
                expiryDate: inventoryLots.expiryDate,
              })
              .from(inventoryLots)
              .where(eq(inventoryLots.id, line.lotId));
            return {
              ...line,
              lotNumber: lotResult[0]?.lotNumber || null,
              lotExpiryDate: lotResult[0]?.expiryDate || null,
            };
          }
          return { ...line, lotNumber: null, lotExpiryDate: null };
        })
      );

      // Get QC tests for this work order
      const qcTestsResult = await db
        .select({
          id: qualityTests.id,
          testCode: qualityTests.testCode,
          testType: qualityTests.testType,
          status: qualityTests.status,
          result: qualityTests.result,
          testedAt: qualityTests.testedAt,
        })
        .from(qualityTests)
        .where(eq(qualityTests.woId, parseInt(id)));

      // Calculate yield
      const yieldPercent = workOrder.plannedQty && workOrder.actualQty
        ? Math.round((workOrder.actualQty / workOrder.plannedQty) * 100 * 100) / 100
        : null;

      // Calculate material consumption
      const materialConsumption = linesWithLots.map((line: any) => ({
        ...line,
        consumptionPercent: line.plannedQty && line.actualQty
          ? Math.round((line.actualQty / line.plannedQty) * 100 * 100) / 100
          : null,
        variance: line.plannedQty && line.actualQty
          ? line.actualQty - line.plannedQty
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
        plannedQty: workOrder.plannedQty,
        actualQty: workOrder.actualQty,
        yieldPercent,
        productionTimeHours,
        status: workOrder.status,
        materials: materialConsumption,
        qcTests: qcTestsResult,
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
          qcTests: qcTestsResult,
          ebmr,
          summary: {
            yieldPercent,
            productionTimeHours,
            materialCount: linesWithLots.length,
            qcTestCount: qcTestsResult.length,
            qcPassCount: qcTestsResult.filter((t: any) => t.result === 'pass').length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching work order details:', error);
      return serverErrorResponse(error);
    }
  });
}
