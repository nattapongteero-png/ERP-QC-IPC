import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import { 
  sqliteSalesOrders, sqliteSalesOrderLines, sqliteItems, sqliteCustomers, sqliteInventoryLots,
  mysqlSalesOrders, mysqlSalesOrderLines, mysqlItems, mysqlCustomers, mysqlInventoryLots
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
      const salesOrders = useSqlite() ? sqliteSalesOrders : mysqlSalesOrders;
      const salesOrderLines = useSqlite() ? sqliteSalesOrderLines : mysqlSalesOrderLines;
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const customers = useSqlite() ? sqliteCustomers : mysqlCustomers;
      const inventoryLots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;

      // Get SO details
      const soResult = await db
        .select({
          id: salesOrders.id,
          soNumber: salesOrders.soNumber,
          customerId: salesOrders.customerId,
          customerCode: customers.code,
          customerName: customers.name,
          customerContact: customers.contactPerson,
          customerPhone: customers.phone,
          customerEmail: customers.email,
          customerAddress: customers.address,
          orderDate: salesOrders.orderDate,
          requestedDate: salesOrders.requestedDate,
          status: salesOrders.status,
          totalAmount: salesOrders.totalAmount,
          notes: salesOrders.notes,
          createdAt: salesOrders.createdAt,
          updatedAt: salesOrders.updatedAt,
        })
        .from(salesOrders)
        .leftJoin(customers, eq(salesOrders.customerId, customers.id))
        .where(eq(salesOrders.id, parseInt(id)));

      if (soResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Sales order not found' }, { status: 404 });
      }

      const so = soResult[0];

      // Get SO lines
      const linesResult = await db
        .select({
          id: salesOrderLines.id,
          itemId: salesOrderLines.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          itemNameEn: items.nameEn,
          itemUnit: items.unit,
          quantity: salesOrderLines.quantity,
          unitPrice: salesOrderLines.unitPrice,
          shippedQty: salesOrderLines.shippedQty,
        })
        .from(salesOrderLines)
        .leftJoin(items, eq(salesOrderLines.itemId, items.id))
        .where(eq(salesOrderLines.soId, parseInt(id)));

      // Calculate line totals and fulfillment status
      const linesWithTotals = await Promise.all(
        linesResult.map(async (line: any) => {
          // Get available stock for this item using FEFO
          const availableLots = await db
            .select({
              id: inventoryLots.id,
              lotNumber: inventoryLots.lotNumber,
              quantity: inventoryLots.quantity,
              expiryDate: inventoryLots.expiryDate,
            })
            .from(inventoryLots)
            .where(eq(inventoryLots.itemId, line.itemId));

          const releasedLots = availableLots.filter((lot: any) => lot.quantity > 0);
          const totalAvailable = releasedLots.reduce((sum: number, lot: any) => sum + lot.quantity, 0);

          return {
            ...line,
            lineTotal: (line.quantity || 0) * (line.unitPrice || 0),
            pendingQty: (line.quantity || 0) - (line.shippedQty || 0),
            fulfillmentStatus: line.shippedQty >= line.quantity ? 'shipped' : 
                              line.shippedQty > 0 ? 'partial' : 'pending',
            availableStock: totalAvailable,
            canFulfill: totalAvailable >= ((line.quantity || 0) - (line.shippedQty || 0)),
            suggestedLots: releasedLots.sort((a: any, b: any) => {
              if (!a.expiryDate) return 1;
              if (!b.expiryDate) return -1;
              return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }).slice(0, 3),
          };
        })
      );

      // Calculate summary
      const totalOrdered = linesWithTotals.reduce((sum: number, line: any) => sum + (line.quantity || 0), 0);
      const totalShipped = linesWithTotals.reduce((sum: number, line: any) => sum + (line.shippedQty || 0), 0);
      const totalPending = totalOrdered - totalShipped;
      const fulfillmentProgress = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
      const allCanFulfill = linesWithTotals.every((line: any) => line.canFulfill);

      return NextResponse.json({
        success: true,
        data: {
          salesOrder: so,
          lines: linesWithTotals,
          summary: {
            lineCount: linesWithTotals.length,
            totalOrdered,
            totalShipped,
            totalPending,
            fulfillmentProgress,
            totalAmount: so.totalAmount || linesWithTotals.reduce((sum: number, line: any) => sum + line.lineTotal, 0),
            allCanFulfill,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching sales order details:', error);
      return serverErrorResponse(error);
    }
  });
}
