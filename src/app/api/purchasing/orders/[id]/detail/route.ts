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

      const purchaseOrders = getTableRef('purchaseOrders');
      const purchaseOrderLines = getTableRef('purchaseOrderLines');
      const items = getTableRef('items');
      const vendors = getTableRef('vendors');
      const inventoryLots = getTableRef('inventoryLots');

      // Get PO details
      const poResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrders.id,
            poNumber: purchaseOrders.poNumber,
            vendorId: purchaseOrders.vendorId,
            vendorCode: vendors.code,
            vendorName: vendors.name,
            vendorContact: vendors.contactPerson,
            vendorPhone: vendors.phone,
            vendorEmail: vendors.email,
            orderDate: purchaseOrders.orderDate,
            expectedDate: purchaseOrders.expectedDate,
            status: purchaseOrders.status,
            totalAmount: purchaseOrders.totalAmount,
            notes: purchaseOrders.notes,
            createdAt: purchaseOrders.createdAt,
            updatedAt: purchaseOrders.updatedAt,
          })
          .from(purchaseOrders)
          .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
          .where(eq(purchaseOrders.id, parseInt(id)));
      });

      if (poResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
      }

      const po = poResult[0];

      // Get PO lines
      const linesResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: purchaseOrderLines.id,
            itemId: purchaseOrderLines.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemUnit: items.primaryUnit,
            quantity: purchaseOrderLines.quantity,
            unitPrice: purchaseOrderLines.unitPrice,
            receivedQty: purchaseOrderLines.receivedQuantity,
            unit: purchaseOrderLines.unit,
            totalPrice: purchaseOrderLines.totalPrice,
          })
          .from(purchaseOrderLines)
          .leftJoin(items, eq(purchaseOrderLines.itemId, items.id))
          .where(eq(purchaseOrderLines.poId, parseInt(id)));
      });

      // Calculate line totals and receiving status
      const linesWithTotals = linesResult.map((line: Record<string, unknown>) => {
        const quantity = Number(line.quantity) || 0;
        const receivedQty = Number(line.receivedQty) || 0;
        const unitPrice = Number(line.unitPrice) || 0;
        const totalPrice = Number(line.totalPrice) || 0;

        return {
          ...line,
          quantity,
          receivedQty,
          unitPrice,
          lineTotal: totalPrice || (quantity * unitPrice),
          pendingQty: quantity - receivedQty,
          receivingStatus: receivedQty >= quantity ? 'complete' :
                          receivedQty > 0 ? 'partial' : 'pending',
        };
      });

      // Get received lots for this PO
      const receivedLots = await executeDbOperation(async (db) => {
        return db
          .select({
            id: inventoryLots.id,
            lotNumber: inventoryLots.lotNumber,
            itemId: inventoryLots.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            quantity: inventoryLots.quantity,
            status: inventoryLots.status,
            expiryDate: inventoryLots.expiryDate,
            receivedDate: inventoryLots.receivedDate,
          })
          .from(inventoryLots)
          .leftJoin(items, eq(inventoryLots.itemId, items.id))
          .where(eq(inventoryLots.poNumber, po.poNumber as string));
      });

      // Calculate summary
      const totalOrdered = linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.quantity as number), 0);
      const totalReceived = linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.receivedQty as number), 0);
      const totalPending = totalOrdered - totalReceived;
      const receivingProgress = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

      return NextResponse.json({
        success: true,
        data: {
          purchaseOrder: po,
          lines: linesWithTotals,
          receivedLots,
          summary: {
            lineCount: linesWithTotals.length,
            totalOrdered,
            totalReceived,
            totalPending,
            receivingProgress,
            totalAmount: po.totalAmount || linesWithTotals.reduce((sum: number, line: Record<string, unknown>) => sum + (line.lineTotal as number), 0),
            lotsReceived: receivedLots.length,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching purchase order details:', error);
      return serverErrorResponse(error);
    }
  });
}
