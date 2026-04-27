import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, getAffectedRows } from '@/lib/db/db-helper';
import { successResponse, errorResponse, serverErrorResponse, withAuth } from '@/lib/api-utils';
import { getNow } from '@/lib/db/date-utils';
import { realtimeBus } from '@/lib/realtime';

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
            itemId: workOrderMaterialsTable.itemId,
            plannedQuantity: workOrderMaterialsTable.plannedQuantity,
            unit: workOrderMaterialsTable.unit,
            itemCode: itemsTable.code,
            itemName: itemsTable.nameTh,
            primaryUnit: itemsTable.primaryUnit,
            secondaryUnit: itemsTable.secondaryUnit,
            conversionRate: itemsTable.conversionRate,
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
        { id: workOrderId, requisitionStatus: 'approved' },
        'Material requisition approved successfully'
      );
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
