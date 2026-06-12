import { NextRequest } from 'next/server';
import { getTableRef, executeDbOperation, dbDate, getInsertId, parseDbDate } from '@/lib/db/db-helper';
import { eq, and, sql } from 'drizzle-orm';
import { withAuth, successResponse, errorResponse, serverErrorResponse } from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { recalculateItemOnHand } from '@/lib/services/inventory.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (session) => {
    try {
      const { id } = await params;
      const poId = parseInt(id);
      const body = await request.json();
      const { lineId, lotNumber, vendorLotNumber, manufacturingDate, quantity, expiryDate, warehouseId } = body;

      if (!lineId || !lotNumber || !quantity || !expiryDate || !warehouseId) {
        return errorResponse('Line ID, lot number, quantity, expiry date, and warehouse are required');
      }

      if (!vendorLotNumber) {
        return errorResponse('Vendor Lot No. is required — กรุณาระบุเลข Lot/Batch จาก Supplier');
      }

      if (!manufacturingDate) {
        return errorResponse('Manufacturing Date is required — กรุณาระบุวันผลิต');
      }

      if (quantity <= 0) {
        return errorResponse('Quantity must be greater than 0');
      }

      const purchaseOrders = getTableRef('purchaseOrders');
      const purchaseOrderLines = getTableRef('purchaseOrderLines');
      const inventoryLots = getTableRef('inventoryLots');
      const items = getTableRef('items');
      const warehouses = getTableRef('warehouses');

      // Validate warehouse exists and is active
      const warehouseResult = await executeDbOperation(async (db) => {
        return db
          .select({ id: warehouses.id })
          .from(warehouses)
          .where(and(eq(warehouses.id, warehouseId), eq(warehouses.isActive, true)))
          .limit(1);
      });

      if (warehouseResult.length === 0) {
        return errorResponse('Invalid or inactive warehouse selected');
      }

      // Get PO
      const poResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(purchaseOrders)
          .where(eq(purchaseOrders.id, poId));
      });

      if (poResult.length === 0) {
        return errorResponse('Purchase order not found', 404);
      }

      const po = poResult[0];

      // Get PO line with item info and unit price
      const lineResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrderLines.id,
            itemId: purchaseOrderLines.itemId,
            quantity: purchaseOrderLines.quantity,
            receivedQuantity: purchaseOrderLines.receivedQuantity,
            unit: purchaseOrderLines.unit,
            unitPrice: purchaseOrderLines.unitPrice,
            itemUnit: items.primaryUnit,
          })
          .from(purchaseOrderLines)
          .leftJoin(items, eq(purchaseOrderLines.itemId, items.id))
          .where(and(
            eq(purchaseOrderLines.id, lineId),
            eq(purchaseOrderLines.poId, poId)
          ));
      });

      if (lineResult.length === 0) {
        return errorResponse('PO line not found', 404);
      }

      const line = lineResult[0];
      const lineQuantity = Number(line.quantity) || 0;
      const lineReceivedQuantity = Number(line.receivedQuantity) || 0;
      const receiveQuantity = Number(quantity);
      const pendingQty = lineQuantity - lineReceivedQuantity;

      if (receiveQuantity > pendingQty) {
        return errorResponse(`Cannot receive more than pending quantity (${pendingQty})`);
      }

      // Create inventory lot with cost from PO line
      const unitCost = Number(line.unitPrice) || 0;
      const lotResult = await executeDbOperation(async (db) => {
        return db.insert(inventoryLots).values({
          lotNumber,
          vendorLotNumber: vendorLotNumber || null,
          itemId: line.itemId,
          warehouseId: warehouseId,
          quantity: receiveQuantity,
          unit: line.unit || line.itemUnit || 'unit',
          status: 'quarantine',
          cost: unitCost > 0 ? unitCost : null,
          manufacturingDate: manufacturingDate ? parseDbDate(manufacturingDate) : null,
          expiryDate: parseDbDate(expiryDate),
          receivedDate: dbDate(),
          poNumber: po.poNumber,
          createdAt: dbDate(),
          updatedAt: dbDate(),
        });
      });

      const lotId = getInsertId(lotResult);

      // Snapshot balance after lot creation
      const inventoryTransactions = getTableRef('inventoryTransactions');
      const inventoryLotsRef = getTableRef('inventoryLots');
      const [itemBalanceRow] = await executeDbOperation(async (db) => {
        return db.select({ total: sql`COALESCE(SUM(${inventoryLotsRef.quantity}), 0)` })
          .from(inventoryLotsRef)
          .where(eq(inventoryLotsRef.itemId, line.itemId));
      });
      const itemBalanceAfter = Number(itemBalanceRow?.total) || 0;

      // Create inventory transaction record for receiving
      await executeDbOperation(async (db) => {
        return db.insert(inventoryTransactions).values({
          lotId: Number(lotId),
          transactionType: 'receive',
          quantity: receiveQuantity,
          unit: line.unit || line.itemUnit || 'unit',
          referenceType: 'purchase_order',
          referenceId: poId,
          referenceNumber: po.poNumber,
          toWarehouseId: warehouseId,
          reason: `Received from ${po.poNumber}`,
          performedBy: session.userId,
          balanceAfter: receiveQuantity,
          itemBalanceAfter,
          createdAt: dbDate(),
        });
      });

      // Update PO line received quantity
      const newReceivedQty = lineReceivedQuantity + receiveQuantity;
      await executeDbOperation(async (db) => {
        return db
          .update(purchaseOrderLines)
          .set({ receivedQuantity: newReceivedQty })
          .where(eq(purchaseOrderLines.id, lineId));
      });

      // Check if all lines are fully received, update PO status
      const allLines = await executeDbOperation(async (db) => {
        return db
          .select({
            quantity: purchaseOrderLines.quantity,
            receivedQuantity: purchaseOrderLines.receivedQuantity,
          })
          .from(purchaseOrderLines)
          .where(eq(purchaseOrderLines.poId, poId));
      });

      const totalOrdered = allLines.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.quantity) || 0), 0);
      const totalReceived = allLines.reduce((sum: number, l: Record<string, unknown>) => sum + (Number(l.receivedQuantity) || 0), 0) + receiveQuantity - lineReceivedQuantity;

      let newStatus = po.status;
      if (totalReceived >= totalOrdered) {
        newStatus = 'received';
      } else if (totalReceived > 0) {
        newStatus = 'partial';
      }

      if (newStatus !== po.status) {
        await executeDbOperation(async (db) => {
          return db
            .update(purchaseOrders)
            .set({
              status: newStatus,
              updatedAt: dbDate(),
            })
            .where(eq(purchaseOrders.id, poId));
        });
      }

      // Ensure the PO appears on the GRN/QC flow. This legacy receive path
      // creates a quarantine lot directly; auto-create the GRN too (idempotent)
      // so the lines surface in QC Entry's "รอลงทะเบียน" panel. Best-effort.
      try {
        const { autoCreateGrnForSource } = await import('@/lib/services/goods-receipt.service');
        await autoCreateGrnForSource({ sourceType: 'po', poId, userId: session.userId });
      } catch (err) {
        console.warn('PO-receive auto-GRN failed (non-fatal):', err);
      }

      await createAuditLog({
        userId: session.userId,
        action: 'CREATE',
        tableName: 'inventory_lots',
        recordId: Number(lotId),
        newValue: { lotNumber, itemId: line.itemId, quantity: receiveQuantity, poNumber: po.poNumber },
        ipAddress: getClientIP(request),
      });

      // Recalculate item onHand and quarantineQty
      await recalculateItemOnHand(line.itemId);

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
