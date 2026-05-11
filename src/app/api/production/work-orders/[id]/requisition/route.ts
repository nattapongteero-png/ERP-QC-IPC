import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getAffectedRows } from '@/lib/db/db-helper';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getNow } from '@/lib/db/date-utils';
import { realtimeBus } from '@/lib/realtime';
import { getLotsForPicking, issueMaterial } from '@/lib/services/inventory.service';
import { calculateIssuance, type UnitConfig } from '@/lib/utils/unit-conversion';

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/production/work-orders/[id]/requisition
// Body: { action: 'request' | 'approve' }
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);

      if (isNaN(workOrderId)) {
        return errorResponse('Invalid work order ID');
      }

      const body = await request.json();
      const { action } = body as { action: string };

      if (action !== 'request' && action !== 'approve') {
        return errorResponse("Action must be 'request' or 'approve'");
      }

      const workOrdersTable = getTableRef('workOrders');

      // Fetch existing work order
      const existing = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrdersTable)
          .where(eq(workOrdersTable.id, workOrderId))
          .limit(1);
      });

      if (existing.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const wo = existing[0];

      if (action === 'request') {
        // Validate: WO status must be planned, released, or in_progress
        if (!['planned', 'released', 'in_progress'].includes(wo.status as string)) {
          return errorResponse(
            `Cannot request materials for work order with status '${wo.status}'. Status must be 'planned', 'released' or 'in_progress'.`
          );
        }

        // Validate: requisitionStatus must be 'none'
        if (wo.requisitionStatus !== 'none') {
          return errorResponse(
            `Requisition already submitted (current status: '${wo.requisitionStatus}').`
          );
        }

        await executeDbOperation(async (db) => {
          return db
            .update(workOrdersTable)
            .set({
              requisitionStatus: 'requested',
              requisitionRequestedBy: session.userId,
              requisitionRequestedAt: getNow(),
            })
            .where(eq(workOrdersTable.id, workOrderId));
        });

        return successResponse(
          { id: workOrderId, requisitionStatus: 'requested' },
          'Material requisition submitted successfully'
        );
      }

      // action === 'approve'
      // Validate: requisitionStatus must be 'requested'
      if (wo.requisitionStatus !== 'requested') {
        return errorResponse(
          `Cannot approve requisition with status '${wo.requisitionStatus}'. Status must be 'requested'.`
        );
      }

      // Validate: check material availability before approval
      const workOrderMaterialsTable = getTableRef('workOrderMaterials');
      const itemsTable = getTableRef('items');
      const lotsTable = getTableRef('inventoryLots');

      const materials = await executeDbOperation(async (db) => {
        return db
          .select({
            materialId: workOrderMaterialsTable.id,
            itemId: workOrderMaterialsTable.itemId,
            plannedQuantity: workOrderMaterialsTable.plannedQuantity,
            unit: workOrderMaterialsTable.unit,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            primaryUnit: itemsTable.primaryUnit,
            secondaryUnit: itemsTable.secondaryUnit,
            conversionRate: itemsTable.conversionRate,
            // 3-level unit conversion (PU → SU → WU)
            weightUnit: itemsTable.weightUnit,
            secondaryToWeightRate: itemsTable.secondaryToWeightRate,
            weightTrackingEnabled: itemsTable.weightTrackingEnabled,
          })
          .from(workOrderMaterialsTable)
          .leftJoin(itemsTable, eq(workOrderMaterialsTable.itemId, itemsTable.id))
          .where(eq(workOrderMaterialsTable.workOrderId, workOrderId));
      });

      // Check available released lot quantities for each material
      const insufficientMaterials: { itemCode: string; itemName: string; required: number; available: number; unit: string }[] = [];

      for (const mat of materials) {
        const requiredQty = Number(mat.plannedQuantity) || 0;
        if (requiredQty <= 0) continue;

        // Sum available quantity from released lots (in item's primary unit)
        const availableResult = await executeDbOperation(async (db) => {
          return db
            .select({
              totalAvailable: sql<string>`COALESCE(SUM(${lotsTable.quantity} - ${lotsTable.reservedQuantity}), 0)`,
            })
            .from(lotsTable)
            .where(and(
              eq(lotsTable.itemId, mat.itemId),
              eq(lotsTable.status, 'released'),
              sql`${lotsTable.quantity} - ${lotsTable.reservedQuantity} > 0`
            ));
        });

        let availableQty = Number(availableResult[0]?.totalAvailable) || 0;

        // Convert available stock to material's unit if they differ
        // e.g., inventory in kg, material needs g → multiply by conversionRate
        if (mat.unit && mat.secondaryUnit && mat.conversionRate &&
            mat.unit === mat.secondaryUnit && Number(mat.conversionRate) > 0) {
          availableQty = availableQty * Number(mat.conversionRate);
        }

        if (availableQty < requiredQty) {
          insufficientMaterials.push({
            itemCode: mat.itemCode || `ID:${mat.itemId}`,
            itemName: mat.itemName || '',
            required: requiredQty,
            available: availableQty,
            unit: mat.unit as string,
          });
        }
      }

      if (insufficientMaterials.length > 0) {
        const details = insufficientMaterials
          .map(m => `${m.itemCode} (${m.itemName}): ต้องการ ${m.required.toLocaleString()} ${m.unit} แต่มี ${m.available.toLocaleString()} ${m.unit}`)
          .join('\n');

        return errorResponse(
          `วัตถุดิบไม่เพียงพอ ไม่สามารถอนุมัติได้\n${details}`
        );
      }

      // Save stock snapshot at approval time for each material
      for (const mat of materials) {
        const availableResult = await executeDbOperation(async (db) => {
          return db
            .select({
              totalAvailable: sql<string>`COALESCE(SUM(${lotsTable.quantity} - ${lotsTable.reservedQuantity}), 0)`,
            })
            .from(lotsTable)
            .where(and(
              eq(lotsTable.itemId, mat.itemId),
              eq(lotsTable.status, 'released'),
              sql`${lotsTable.quantity} - ${lotsTable.reservedQuantity} > 0`
            ));
        });

        let stockSnapshot = Number(availableResult[0]?.totalAvailable) || 0;
        // Convert to material unit if needed
        if (mat.unit && mat.secondaryUnit && mat.conversionRate &&
            mat.unit === mat.secondaryUnit && Number(mat.conversionRate) > 0) {
          stockSnapshot = stockSnapshot * Number(mat.conversionRate);
        }

        await executeDbOperation(async (db) => {
          return db
            .update(workOrderMaterialsTable)
            .set({ stockAtApproval: stockSnapshot })
            .where(and(
              eq(workOrderMaterialsTable.workOrderId, workOrderId),
              eq(workOrderMaterialsTable.itemId, mat.itemId),
            ));
        });
      }

      // Physical-issuance step (3-level items only).
      //
      // For items with weight tracking enabled, the warehouse releases whole
      // primary units (e.g. 2 boxes for a 1,700-capsule request). Stock is
      // deducted now so production picks up the physical containers; the later
      // weighing step will NOT deduct again (verifyMaterialWeight checks
      // status='issued' and skips). Any unused remainder must come back through
      // the material-return flow.
      const issuedSummaries: { itemCode: string; puToIssue: number; pu: string; suIssued: number; su: string }[] = [];
      for (const mat of materials) {
        const tracked = mat.weightTrackingEnabled === true || mat.weightTrackingEnabled === 1;
        const ratio1 = Number(mat.conversionRate);
        if (!tracked || !Number.isFinite(ratio1) || ratio1 <= 0) continue;
        if (!mat.primaryUnit || !mat.secondaryUnit) continue;

        // Coerce planned BOM qty into SU.
        let plannedSU: number;
        if (mat.unit === mat.secondaryUnit) {
          plannedSU = Number(mat.plannedQuantity);
        } else if (mat.unit === mat.primaryUnit) {
          plannedSU = Number(mat.plannedQuantity) * ratio1;
        } else {
          // Unknown BOM unit — skip issuance, fall through to weighing-time deduction.
          continue;
        }
        if (!Number.isFinite(plannedSU) || plannedSU <= 0) continue;

        const config: UnitConfig = {
          primaryUnit: mat.primaryUnit,
          secondaryUnit: mat.secondaryUnit,
          weightUnit: mat.weightUnit,
          conversionRate: ratio1,
          secondaryToWeightRate: Number(mat.secondaryToWeightRate) || null,
          weightTrackingEnabled: true,
        };
        const issuance = calculateIssuance(plannedSU, config);
        const puToIssue = issuance.puToIssue; // qty in PRIMARY unit (= lot.unit)

        // FEFO allocate puToIssue across released lots
        const { allocated } = await getLotsForPicking(mat.itemId, puToIssue);
        if (allocated.length === 0) {
          throw new Error(
            `วัตถุดิบ ${mat.itemCode} ไม่พอสำหรับปล่อยของ — ต้องการ ${puToIssue} ${mat.primaryUnit}`
          );
        }

        const refNumber = wo.woNumber as string;
        const batchNumber = wo.batchNumber as string;
        let totalIssuedPU = 0;
        for (const alloc of allocated) {
          await issueMaterial(
            alloc.lotId,
            alloc.quantity,
            'WO',
            workOrderId,
            refNumber,
            session.userId,
            `Material requisition release for ${refNumber}`,
            { workOrderId, batchNumber }
          );
          totalIssuedPU += alloc.quantity;
        }

        // Mark material row as 'issued' so weighing flow skips deduction.
        await executeDbOperation(async (db) => {
          return db
            .update(workOrderMaterialsTable)
            .set({
              status: 'issued',
              actualQuantity: totalIssuedPU, // primary-unit value (matches verify path)
              issuedQty: totalIssuedPU * ratio1, // SU equivalent for downstream return-flow math
              issuedBy: session.userId,
              issuedAt: getNow(),
              lotId: allocated[0].lotId,
            })
            .where(eq(workOrderMaterialsTable.id, mat.materialId));
        });

        issuedSummaries.push({
          itemCode: mat.itemCode || `ID:${mat.itemId}`,
          puToIssue: totalIssuedPU,
          pu: mat.primaryUnit,
          suIssued: totalIssuedPU * ratio1,
          su: mat.secondaryUnit,
        });
      }

      // Atomic guard: only update if status is still 'requested'.
      // If another concurrent approval already changed the status, affectedRows = 0
      // and we return a 409 telling the caller to refresh.
      const updateResult = await executeDbOperation(async (db) => {
        return db
          .update(workOrdersTable)
          .set({
            requisitionStatus: 'approved',
            requisitionApprovedBy: session.userId,
            requisitionApprovedAt: getNow(),
          })
          .where(and(
            eq(workOrdersTable.id, workOrderId),
            eq(workOrdersTable.requisitionStatus, 'requested'),
          ));
      });

      if (getAffectedRows(updateResult) === 0) {
        return errorResponse(
          'ใบเบิกนี้ถูกอนุมัติไปแล้ว — กรุณา refresh หน้าจอ',
          409
        );
      }

      // Notify subscribers (other browser tabs) that this requisition changed.
      // Done after commit succeeded; never published on failure.
      realtimeBus.publish('requisition-changed', {
        workOrderId,
        status: 'approved',
        changedBy: session.userId,
      });

      return successResponse(
        { id: workOrderId, requisitionStatus: 'approved', issued: issuedSummaries },
        issuedSummaries.length > 0
          ? `อนุมัติและปล่อยของแล้ว — ${issuedSummaries.length} รายการ`
          : 'Material requisition approved successfully'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
