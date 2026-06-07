import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate, getInsertId } from '@/lib/db/db-helper';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

// GET /api/production/work-orders/[id]/materials - List materials for a work order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;

      const workOrderMaterials = getTableRef('workOrderMaterials');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');

      const materials = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrderMaterials.id,
            itemId: workOrderMaterials.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemUnit: items.primaryUnit,
            lotId: workOrderMaterials.lotId,
            lotNumber: inventoryLots.lotNumber,
            plannedQuantity: workOrderMaterials.plannedQuantity,
            actualQuantity: workOrderMaterials.actualQuantity,
            additionalQtyViaWithdrawalRequest: workOrderMaterials.additionalQtyViaWithdrawalRequest,
            unit: workOrderMaterials.unit,
            status: workOrderMaterials.status,
          })
          .from(workOrderMaterials)
          .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
          .leftJoin(inventoryLots, eq(workOrderMaterials.lotId, inventoryLots.id))
          .where(eq(workOrderMaterials.workOrderId, parseInt(id)));
      });

      return successResponse(materials);
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:read']);
}

// POST /api/production/work-orders/[id]/materials - Add material to work order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const workOrderId = parseInt(id);
      const body = await request.json();
      const { itemId, lotId, plannedQuantity, actualQuantity, unit } = body;

      if (!itemId || !plannedQuantity || !unit) {
        return errorResponse('Item ID, planned quantity, and unit are required');
      }

      const workOrders = getTableRef('workOrders');
      const workOrderMaterials = getTableRef('workOrderMaterials');
      const inventoryLots = getTableRef('inventoryLots');
      const inventoryTransactions = getTableRef('inventoryTransactions');

      // Check work order exists and is in valid status
      const workOrderResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(workOrders)
          .where(eq(workOrders.id, workOrderId));
      });

      if (workOrderResult.length === 0) {
        return errorResponse('Work order not found', 404);
      }

      const workOrder = workOrderResult[0];
      const allowedStatuses = ['draft', 'planned', 'released', 'in_progress'];
      if (!allowedStatuses.includes(workOrder.status)) {
        return errorResponse(`Cannot add materials to work order with status: ${workOrder.status}`);
      }

      // If lotId is provided, validate lot availability
      if (lotId) {
        const lotResult = await executeDbOperation(async (db) => {
          return db
            .select()
            .from(inventoryLots)
            .where(eq(inventoryLots.id, lotId));
        });

        if (lotResult.length === 0) {
          return errorResponse('Lot not found', 404);
        }

        const lot = lotResult[0];
        if (lot.status !== 'released') {
          return errorResponse(`Lot status must be 'released', current status: ${lot.status}`);
        }

        const availableQty = Number(lot.quantity) - Number(lot.reservedQuantity || 0);
        const qtyToUse = actualQuantity || plannedQuantity;
        if (availableQty < qtyToUse) {
          return errorResponse(`Insufficient lot quantity. Available: ${availableQty}, Required: ${qtyToUse}`);
        }

        // Reserve quantity in lot
        await executeDbOperation(async (db) => {
          return db
            .update(inventoryLots)
            .set({
              reservedQuantity: sql`${inventoryLots.reservedQuantity} + ${qtyToUse}`,
            })
            .where(eq(inventoryLots.id, lotId));
        });
      }

      // Add material to work order
      const result = await executeDbOperation(async (db) => {
        return db.insert(workOrderMaterials).values({
          workOrderId,
          itemId,
          lotId: lotId || null,
          plannedQuantity,
          actualQuantity: actualQuantity || null,
          unit,
          status: lotId ? 'issued' : 'pending',
          issuedBy: lotId ? session.userId : null,
          issuedAt: lotId ? dbDate() : null,
        });
      });

      const materialId = getInsertId(result);

      // If lot is provided and actualQuantity, create inventory transaction
      if (lotId && actualQuantity) {
        // Snapshot balance after reservation
        const [lotAfter] = await executeDbOperation(async (db) => {
          return db.select({ quantity: inventoryLots.quantity }).from(inventoryLots).where(eq(inventoryLots.id, lotId));
        });
        const lotItemId = (await executeDbOperation(async (db) => {
          return db.select({ itemId: inventoryLots.itemId }).from(inventoryLots).where(eq(inventoryLots.id, lotId));
        }))[0]?.itemId;
        const [itemBalRow] = await executeDbOperation(async (db) => {
          return db.select({ total: sql`COALESCE(SUM(${inventoryLots.quantity}), 0)` })
            .from(inventoryLots).where(eq(inventoryLots.itemId, lotItemId));
        });

        await executeDbOperation(async (db) => {
          return db.insert(inventoryTransactions).values({
            lotId,
            transactionType: 'issue',
            quantity: actualQuantity,
            unit,
            referenceType: 'WO',
            referenceId: workOrderId,
            referenceNumber: workOrder.woNumber,
            reason: 'Material issued to work order',
            performedBy: session.userId,
            balanceAfter: Number(lotAfter?.quantity) || 0,
            itemBalanceAfter: Number(itemBalRow?.total) || 0,
            createdAt: dbDate(),
          });
        });
      }

      // Audit log
      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'work_order_materials',
        recordId: Number(materialId),
        newValue: { workOrderId, itemId, lotId, plannedQuantity, actualQuantity },
        ipAddress: getClientIP(request),
      });

      return successResponse({ id: Number(materialId) }, 'Material added to work order');
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['production:write']);
}
