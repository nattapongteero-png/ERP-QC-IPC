import { NextRequest, NextResponse } from 'next/server';
import { getDb, isSqlite } from '@/lib/db';
import { 
  sqlitePurchaseOrders, sqlitePurchaseOrderLines, sqliteItems, sqliteVendors, sqliteInventoryLots,
  mysqlPurchaseOrders, mysqlPurchaseOrderLines, mysqlItems, mysqlVendors, mysqlInventoryLots
} from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const purchaseOrders = isSqlite() ? sqlitePurchaseOrders : mysqlPurchaseOrders;
      const purchaseOrderLines = isSqlite() ? sqlitePurchaseOrderLines : mysqlPurchaseOrderLines;
      const items = isSqlite() ? sqliteItems : mysqlItems;
      const vendors = isSqlite() ? sqliteVendors : mysqlVendors;
      const inventoryLots = isSqlite() ? sqliteInventoryLots : mysqlInventoryLots;

      // Get PO details
      const poResult = await db
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

      if (poResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Purchase order not found' }, { status: 404 });
      }

      const po = poResult[0];

      // Get PO lines
      const linesResult = await db
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

      // Calculate line totals and receiving status
      // Note: MySQL decimal types return as strings, so we must convert to numbers
      const linesWithTotals = linesResult.map((line: any) => {
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
      const receivedLots = await db
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
        .where(eq(inventoryLots.poNumber, po.poNumber));

      // Calculate summary (values already converted to numbers in linesWithTotals)
      const totalOrdered = linesWithTotals.reduce((sum: number, line: any) => sum + line.quantity, 0);
      const totalReceived = linesWithTotals.reduce((sum: number, line: any) => sum + line.receivedQty, 0);
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
            totalAmount: po.totalAmount || linesWithTotals.reduce((sum: number, line: any) => sum + line.lineTotal, 0),
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
