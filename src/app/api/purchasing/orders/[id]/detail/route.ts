import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
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
      const purchaseOrders = useSqlite() ? sqlitePurchaseOrders : mysqlPurchaseOrders;
      const purchaseOrderLines = useSqlite() ? sqlitePurchaseOrderLines : mysqlPurchaseOrderLines;
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const vendors = useSqlite() ? sqliteVendors : mysqlVendors;
      const inventoryLots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;

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
          itemUnit: items.unit,
          quantity: purchaseOrderLines.quantity,
          unitPrice: purchaseOrderLines.unitPrice,
          receivedQty: purchaseOrderLines.receivedQty,
        })
        .from(purchaseOrderLines)
        .leftJoin(items, eq(purchaseOrderLines.itemId, items.id))
        .where(eq(purchaseOrderLines.poId, parseInt(id)));

      // Calculate line totals and receiving status
      const linesWithTotals = linesResult.map((line: any) => ({
        ...line,
        lineTotal: (line.quantity || 0) * (line.unitPrice || 0),
        pendingQty: (line.quantity || 0) - (line.receivedQty || 0),
        receivingStatus: line.receivedQty >= line.quantity ? 'complete' : 
                        line.receivedQty > 0 ? 'partial' : 'pending',
      }));

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

      // Calculate summary
      const totalOrdered = linesWithTotals.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0);
      const totalReceived = linesWithTotals.reduce((sum: number, line: any) => sum + (line.receivedQty || 0), 0);
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
