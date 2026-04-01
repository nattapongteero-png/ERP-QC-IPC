import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq, asc } from 'drizzle-orm';
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
            bomId: workOrders.bomId,
            productId: workOrders.productId,
            productCode: items.code,
            productName: items.nameTh,
            productNameEn: items.nameEn,
            productUnit: items.primaryUnit,
            ttmtCode: items.ttmtCode,
            drugCode24: items.drugCode24,
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

      // Collect all lot IDs related to this work order
      const relatedLotIds = new Set<number>();
      // 1. Material lots
      materialsWithLots.forEach((m: Record<string, unknown>) => {
        if (m.lotId) relatedLotIds.add(m.lotId as number);
      });
      // 2. Lots matching batch number (produced lot + in-process lot)
      if (workOrder.batchNumber) {
        const batchLots = await executeDbOperation(async (db) => {
          return db.select({ id: inventoryLots.id }).from(inventoryLots)
            .where(eq(inventoryLots.batchNumber, workOrder.batchNumber as string));
        });
        batchLots.forEach((l: { id: number }) => relatedLotIds.add(l.id));
      }

      // Get QC tests for all related lots
      let relatedQcTests: Record<string, unknown>[] = [];
      if (relatedLotIds.size > 0) {
        const lotIdArray = Array.from(relatedLotIds);
        const { inArray } = await import('drizzle-orm');
        relatedQcTests = await executeDbOperation(async (db) => {
          return db
            .select({
              id: qualityTests.id,
              lotId: qualityTests.lotId,
              testType: qualityTests.testType,
              sampleNumber: qualityTests.sampleNumber,
              status: qualityTests.status,
              result: qualityTests.result,
              testDate: qualityTests.testDate,
              specSpecification: qualityTests.specSpecification,
              specUnit: qualityTests.specUnit,
              notes: qualityTests.notes,
            })
            .from(qualityTests)
            .where(inArray(qualityTests.lotId, lotIdArray));
        });
        // Map field names for UI compatibility
        relatedQcTests = relatedQcTests.map((t: Record<string, unknown>) => ({
          ...t,
          testCode: `QC-${t.id}`,
          testedAt: t.testDate,
        }));
      }

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

      // Fetch BOM operations (production steps)
      const operations = getTableRef('operations');
      const bomId = workOrder.bomId;

      let bomOperations: Record<string, unknown>[] = [];
      if (bomId) {
        bomOperations = await executeDbOperation(async (db) => {
          return db
            .select({
              id: operations.id,
              sequence: operations.sequence,
              name: operations.name,
              description: operations.description,
              standardTime: operations.standardTime,
              setupTime: operations.setupTime,
              cleaningTime: operations.cleaningTime,
              instructions: operations.instructions,
            })
            .from(operations)
            .where(eq(operations.bomId, bomId as number))
            .orderBy(asc(operations.sequence));
        });
      }

      // Fetch batch records for this work order
      const batchRecords = getTableRef('batchRecords');
      const users = getTableRef('users');
      let batchRecordsList: Record<string, unknown>[] = [];
      try {
        batchRecordsList = await executeDbOperation(async (db) => {
          return db
            .select({
              id: batchRecords.id,
              operationId: batchRecords.operationId,
              sequence: batchRecords.sequence,
              stepName: batchRecords.stepName,
              instructions: batchRecords.instructions,
              parameters: batchRecords.parameters,
              actualValues: batchRecords.actualValues,
              status: batchRecords.status,
              startTime: batchRecords.startTime,
              endTime: batchRecords.endTime,
              performedBy: batchRecords.performedBy,
              verifiedBy: batchRecords.verifiedBy,
              verifiedAt: batchRecords.verifiedAt,
              notes: batchRecords.notes,
            })
            .from(batchRecords)
            .where(eq(batchRecords.workOrderId, parseInt(id)))
            .orderBy(asc(batchRecords.sequence));
        });

        // Resolve performer/verifier names
        batchRecordsList = await Promise.all(
          batchRecordsList.map(async (br) => {
            let performerName = null;
            let verifierName = null;
            if (br.performedBy) {
              const u = await executeDbOperation(async (db) =>
                db.select({ name: users.name }).from(users).where(eq(users.id, br.performedBy as number))
              );
              performerName = u[0]?.name ?? null;
            }
            if (br.verifiedBy) {
              const u = await executeDbOperation(async (db) =>
                db.select({ name: users.name }).from(users).where(eq(users.id, br.verifiedBy as number))
              );
              verifierName = u[0]?.name ?? null;
            }
            // Parse JSON fields
            let parameters = null;
            let actualValues = null;
            try {
              if (br.parameters) parameters = JSON.parse(br.parameters as string);
              if (br.actualValues) actualValues = JSON.parse(br.actualValues as string);
            } catch { /* keep as-is */ }
            return { ...br, performerName, verifierName, parameters, actualValues };
          })
        );
      } catch {
        // batch_records table may not exist in older setups
      }

      // eBMR (Electronic Batch Manufacturing Record) summary
      const ebmr = {
        batchNumber: workOrder.batchNumber,
        productCode: workOrder.productCode,
        productName: workOrder.productName,
        ttmtCode: workOrder.ttmtCode,
        drugCode24: workOrder.drugCode24,
        plannedQty: workOrder.plannedQuantity,
        actualQty: workOrder.actualQuantity,
        yieldPercent,
        productionTimeHours,
        status: workOrder.status,
        materials: materialConsumption,
        qcTests: relatedQcTests,
        operations: bomOperations,
        batchRecords: batchRecordsList,
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
