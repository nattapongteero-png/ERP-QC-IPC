import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';
import { isLotExpired } from '@/lib/utils/lot-expiry';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const salesOrders = getTableRef('salesOrders');
      const salesOrderLines = getTableRef('salesOrderLines');
      const items = getTableRef('items');
      const inventoryLots = getTableRef('inventoryLots');
      const users = getTableRef('users');

      // Get SO details (customer info is stored directly in sales_orders table)
      const soResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: salesOrders.id,
            soNumber: salesOrders.soNumber,
            customerId: salesOrders.customerId,
            customerName: salesOrders.customerName,
            customerContact: salesOrders.customerContact,
            customerAddress: salesOrders.customerAddress,
            orderDate: salesOrders.orderDate,
            requiredDate: salesOrders.requiredDate,
            shippedDate: salesOrders.shippedDate,
            status: salesOrders.status,
            totalAmount: salesOrders.totalAmount,
            currency: salesOrders.currency,
            paymentTerms: salesOrders.paymentTerms,
            notes: salesOrders.notes,
            shippingCost: salesOrders.shippingCost,
            carrier: salesOrders.carrier,
            trackingNumber: salesOrders.trackingNumber,
            createdBy: salesOrders.createdBy,
            createdAt: salesOrders.createdAt,
            updatedAt: salesOrders.updatedAt,
          })
          .from(salesOrders)
          .where(eq(salesOrders.id, parseInt(id)));
      });

      if (soResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Sales order not found' }, { status: 404 });
      }

      const so = soResult[0];

      // Resolve creator display name. SO has no separate approval step — the
      // creator confirms the order — so we surface only "ผู้สร้าง", not an
      // approver (the approvedBy column exists but is never written for SO).
      const createdByName: string | null = so.createdBy
        ? (await executeDbOperation(async (db) =>
            db.select({ name: users.name }).from(users).where(eq(users.id, so.createdBy as number)).limit(1),
          ))[0]?.name ?? null
        : null;

      // Get SO lines
      const linesResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: salesOrderLines.id,
            itemId: salesOrderLines.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemUnit: items.primaryUnit,
            quantity: salesOrderLines.quantity,
            unitPrice: salesOrderLines.unitPrice,
            shippedQty: salesOrderLines.shippedQuantity,
            totalPrice: salesOrderLines.totalPrice,
          })
          .from(salesOrderLines)
          .leftJoin(items, eq(salesOrderLines.itemId, items.id))
          .where(eq(salesOrderLines.soId, parseInt(id)));
      });

      // Calculate line totals and fulfillment status
      // Note: MySQL decimal types return as strings, so we must convert to numbers
      const linesWithTotals = await Promise.all(
        linesResult.map(async (line: {
          id: number;
          itemId: number | null;
          itemCode: string | null;
          itemName: string | null;
          itemNameEn: string | null;
          itemUnit: string | null;
          quantity: number | string;
          unitPrice: number | string;
          shippedQty: number | string;
          totalPrice: number | string;
        }) => {
          // Convert decimal values to numbers
          const quantity = Number(line.quantity) || 0;
          const unitPrice = Number(line.unitPrice) || 0;
          const shippedQty = Number(line.shippedQty) || 0;
          const totalPrice = Number(line.totalPrice) || 0;

          // Get available stock for this item using FEFO
          // Only include released lots (exclude quarantine, under_test, rejected, blocked)
          const availableLots = await executeDbOperation(async (db) => {
            return db
              .select({
                id: inventoryLots.id,
                lotNumber: inventoryLots.lotNumber,
                quantity: inventoryLots.quantity,
                expiryDate: inventoryLots.expiryDate,
                status: inventoryLots.status,
              })
              .from(inventoryLots)
              .where(
                and(
                  eq(inventoryLots.itemId, line.itemId!),
                  eq(inventoryLots.status, 'released')
                )
              );
          });

          // Expired lots are dropped here, not merely refused later.
          //
          // issueMaterial rejects them at the point of issue, but by then the
          // operator has already picked a lot and clicked ship. Worse, the sort
          // below is FEFO — nearest expiry first — so an expired lot would be
          // offered as the FIRST suggestion every time, and availableStock
          // would count stock that can never legally leave, making canFulfill
          // promise a delivery the system will then refuse. UAT currently holds
          // 4 expired lots still marked 'released'.
          const releasedLots = availableLots
            .map((lot: { id: number; lotNumber: string; quantity: number | string; expiryDate: string | Date | null; status: string }) => ({
              ...lot,
              quantity: Number(lot.quantity) || 0
            }))
            .filter((lot: { quantity: number }) => lot.quantity > 0)
            .filter((lot: { expiryDate: string | Date | null }) => !isLotExpired(lot.expiryDate));
          const totalAvailable = releasedLots.reduce((sum: number, lot: { quantity: number }) => sum + lot.quantity, 0);
          const pendingQty = quantity - shippedQty;

          return {
            ...line,
            quantity,
            unitPrice,
            shippedQty,
            lineTotal: totalPrice || (quantity * unitPrice),
            pendingQty,
            fulfillmentStatus: shippedQty >= quantity ? 'shipped' :
                              shippedQty > 0 ? 'partial' : 'pending',
            availableStock: totalAvailable,
            canFulfill: totalAvailable >= pendingQty,
            suggestedLots: releasedLots.sort((a: { expiryDate: string | Date | null }, b: { expiryDate: string | Date | null }) => {
              if (!a.expiryDate) return 1;
              if (!b.expiryDate) return -1;
              return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }).slice(0, 3),
          };
        })
      );

      // Calculate summary (values already converted to numbers in linesWithTotals)
      const totalOrdered = linesWithTotals.reduce((sum: number, line: { quantity: number }) => sum + line.quantity, 0);
      const totalShipped = linesWithTotals.reduce((sum: number, line: { shippedQty: number }) => sum + line.shippedQty, 0);
      const totalPending = totalOrdered - totalShipped;
      const fulfillmentProgress = totalOrdered > 0 ? Math.round((totalShipped / totalOrdered) * 100) : 0;
      const allCanFulfill = linesWithTotals.every((line: { canFulfill: boolean }) => line.canFulfill);

      return NextResponse.json({
        success: true,
        data: {
          salesOrder: { ...so, createdByName },
          lines: linesWithTotals,
          summary: {
            lineCount: linesWithTotals.length,
            totalOrdered,
            totalShipped,
            totalPending,
            fulfillmentProgress,
            totalAmount: Number(so.totalAmount) || linesWithTotals.reduce((sum: number, line: { lineTotal: number }) => sum + line.lineTotal, 0),
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
