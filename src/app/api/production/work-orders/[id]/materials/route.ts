import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb, isSqlite } from '@/lib/db';
import {
  sqliteWorkOrders,
  sqliteWorkOrderMaterials,
  sqliteItems,
  sqliteInventoryLots,
  sqliteInventoryTransactions,
  mysqlWorkOrders,
  mysqlWorkOrderMaterials,
  mysqlItems,
  mysqlInventoryLots,
  mysqlInventoryTransactions,
} from '@/lib/db/schema';
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
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const isSqlite = isSqlite();
      const workOrderMaterials = isSqlite ? sqliteWorkOrderMaterials : mysqlWorkOrderMaterials;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite ? sqliteInventoryLots : mysqlInventoryLots;

      const materials = await db
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
          unit: workOrderMaterials.unit,
          status: workOrderMaterials.status,
        })
        .from(workOrderMaterials)
        .leftJoin(items, eq(workOrderMaterials.itemId, items.id))
        .leftJoin(inventoryLots, eq(workOrderMaterials.lotId, inventoryLots.id))
        .where(eq(workOrderMaterials.workOrderId, parseInt(id)));

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

      const db = await getDb();
      const isSqlite = isSqlite();
      const workOrders = isSqlite ? sqliteWorkOrders : mysqlWorkOrders;
      const workOrderMaterials = isSqlite ? sqliteWorkOrderMaterials : mysqlWorkOrderMaterials;
      const inventoryLots = isSqlite ? sqliteInventoryLots : mysqlInventoryLots;
      const inventoryTransactions = isSqlite ? sqliteInventoryTransactions : mysqlInventoryTransactions;

      // Check work order exists and is in valid status
      const [workOrder] = await db
        .select()
        .from(workOrders)
        .where(eq(workOrders.id, workOrderId));

      if (!workOrder) {
        return errorResponse('Work order not found', 404);
      }

      const allowedStatuses = ['draft', 'planned', 'released', 'in_progress'];
      if (!allowedStatuses.includes(workOrder.status)) {
        return errorResponse(`Cannot add materials to work order with status: ${workOrder.status}`);
      }

      // If lotId is provided, validate lot availability
      if (lotId) {
        const [lot] = await db
          .select()
          .from(inventoryLots)
          .where(eq(inventoryLots.id, lotId));

        if (!lot) {
          return errorResponse('Lot not found', 404);
        }

        if (lot.status !== 'released') {
          return errorResponse(`Lot status must be 'released', current status: ${lot.status}`);
        }

        const availableQty = Number(lot.quantity) - Number(lot.reservedQuantity || 0);
        const qtyToUse = actualQuantity || plannedQuantity;
        if (availableQty < qtyToUse) {
          return errorResponse(`Insufficient lot quantity. Available: ${availableQty}, Required: ${qtyToUse}`);
        }

        // Reserve quantity in lot
        await db
          .update(inventoryLots)
          .set({
            reservedQuantity: sql`${inventoryLots.reservedQuantity} + ${qtyToUse}`,
          })
          .where(eq(inventoryLots.id, lotId));
      }

      // Add material to work order
      const result = await (db as any).insert(workOrderMaterials).values({
        workOrderId,
        itemId,
        lotId: lotId || null,
        plannedQuantity,
        actualQuantity: actualQuantity || null,
        unit,
        status: lotId ? 'issued' : 'pending',
        issuedBy: lotId ? session.userId : null,
        issuedAt: lotId ? (isSqlite ? new Date().toISOString() : new Date()) : null,
      });

      const materialId = isSqlite ? result.lastInsertRowid : result[0].insertId;

      // If lot is provided and actualQuantity, create inventory transaction
      if (lotId && actualQuantity) {
        await (db as any).insert(inventoryTransactions).values({
          lotId,
          transactionType: 'issue',
          quantity: actualQuantity,
          unit,
          referenceType: 'WO',
          referenceId: workOrderId,
          referenceNumber: workOrder.woNumber,
          reason: 'Material issued to work order',
          performedBy: session.userId,
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
