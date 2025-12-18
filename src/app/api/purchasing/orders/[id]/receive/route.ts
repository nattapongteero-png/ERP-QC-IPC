import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import {
  sqlitePurchaseOrders, sqlitePurchaseOrderLines, sqliteInventoryLots, sqliteItems, sqliteWarehouses,
  mysqlPurchaseOrders, mysqlPurchaseOrderLines, mysqlInventoryLots, mysqlItems, mysqlWarehouses
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);
      const body = await request.json();
      const { lineId, lotNumber, quantity, expiryDate, warehouseId } = body;

      if (!lineId || !lotNumber || !quantity || !expiryDate || !warehouseId) {
        return errorResponse('Line ID, lot number, quantity, expiry date, and warehouse are required');
      }

      if (quantity <= 0) {
        return errorResponse('Quantity must be greater than 0');
      }

      const db = await getDb();
      const isSqlite = useSqlite();
      const purchaseOrders = isSqlite ? sqlitePurchaseOrders : mysqlPurchaseOrders;
      const purchaseOrderLines = isSqlite ? sqlitePurchaseOrderLines : mysqlPurchaseOrderLines;
      const inventoryLots = isSqlite ? sqliteInventoryLots : mysqlInventoryLots;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const warehouses = isSqlite ? sqliteWarehouses : mysqlWarehouses;

      // Validate warehouse exists and is active
      const warehouseResult = await db
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(and(eq(warehouses.id, warehouseId), eq(warehouses.isActive, true)))
        .limit(1);

      if (warehouseResult.length === 0) {
        return errorResponse('Invalid or inactive warehouse selected');
      }

      // Get PO
      const poResult = await db
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, poId));

      if (poResult.length === 0) {
        return errorResponse('Purchase order not found', 404);
      }

      const po = poResult[0];

      // Get PO line with item info
      const lineResult = await db
        .select({
          id: purchaseOrderLines.id,
          itemId: purchaseOrderLines.itemId,
          quantity: purchaseOrderLines.quantity,
          receivedQuantity: purchaseOrderLines.receivedQuantity,
          unit: purchaseOrderLines.unit,
          itemUnit: items.primaryUnit,
        })
        .from(purchaseOrderLines)
        .leftJoin(items, eq(purchaseOrderLines.itemId, items.id))
        .where(and(
          eq(purchaseOrderLines.id, lineId),
          eq(purchaseOrderLines.poId, poId)
        ));

      if (lineResult.length === 0) {
        return errorResponse('PO line not found', 404);
      }

      const line = lineResult[0];
      // Convert to numbers - MySQL decimal types return as strings
      const lineQuantity = Number(line.quantity) || 0;
      const lineReceivedQuantity = Number(line.receivedQuantity) || 0;
      const receiveQuantity = Number(quantity);
      const pendingQty = lineQuantity - lineReceivedQuantity;

      if (receiveQuantity > pendingQty) {
        return errorResponse(`Cannot receive more than pending quantity (${pendingQty})`);
      }

      const now = new Date();
      const parsedExpiryDate = isSqlite ? expiryDate : new Date(expiryDate);
      const parsedReceivedDate = isSqlite ? now.toISOString() : now;

      // Create inventory lot
      const lotResult = await (db as any).insert(inventoryLots).values({
        lotNumber,
        itemId: line.itemId,
        warehouseId: warehouseId,
        quantity: receiveQuantity,
        unit: line.unit || line.itemUnit || 'unit',
        status: 'released',
        expiryDate: parsedExpiryDate,
        receivedDate: parsedReceivedDate,
        poNumber: po.poNumber,
        createdAt: isSqlite ? now.toISOString() : now,
        updatedAt: isSqlite ? now.toISOString() : now,
      });

      const lotId = isSqlite ? lotResult.lastInsertRowid : lotResult[0].insertId;

      // Update PO line received quantity
      const newReceivedQty = lineReceivedQuantity + receiveQuantity;
      await db
        .update(purchaseOrderLines)
        .set({ receivedQuantity: newReceivedQty })
        .where(eq(purchaseOrderLines.id, lineId));

      // Check if all lines are fully received, update PO status
      const allLines = await db
        .select({
          quantity: purchaseOrderLines.quantity,
          receivedQuantity: purchaseOrderLines.receivedQuantity,
        })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.poId, poId));

      // Convert to numbers - MySQL decimal types return as strings
      const totalOrdered = allLines.reduce((sum: number, l: { quantity: number | null }) => sum + (Number(l.quantity) || 0), 0);
      // Note: allLines still has the OLD receivedQuantity values, so we adjust for the current update
      const totalReceived = allLines.reduce((sum: number, l: { receivedQuantity: number | null }) => sum + (Number(l.receivedQuantity) || 0), 0) + receiveQuantity - lineReceivedQuantity;

      let newStatus = po.status;
      if (totalReceived >= totalOrdered) {
        newStatus = 'received';
      } else if (totalReceived > 0) {
        newStatus = 'partial';
      }

      if (newStatus !== po.status) {
        await db
          .update(purchaseOrders)
          .set({
            status: newStatus,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(purchaseOrders.id, poId));
      }

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'inventory_lots',
        recordId: Number(lotId),
        newValue: { lotNumber, itemId: line.itemId, quantity: receiveQuantity, poNumber: po.poNumber },
        ipAddress: getClientIP(request),
      });

      return successResponse({
        lotId: Number(lotId),
        lotNumber,
        quantity: receiveQuantity,
        newReceivedQty,
        poStatus: newStatus,
      }, 'Goods received successfully');
    } catch (error) {
      console.error('Error receiving goods:', error);
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
