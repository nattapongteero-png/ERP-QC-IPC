import { NextRequest, NextResponse } from 'next/server';
import { eq, sql, or } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const warehouses = getTableRef('warehouses');
      const inventoryLots = getTableRef('inventoryLots');
      const items = getTableRef('items');
      const transactions = getTableRef('inventoryTransactions');

      // Get warehouse details
      const warehouseResult = await executeDbOperation(async (db) => {
        return db.select().from(warehouses).where(eq(warehouses.id, parseInt(id)));
      });

      if (warehouseResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Warehouse not found' }, { status: 404 });
      }

      const warehouse = warehouseResult[0];

      // Get inventory lots in this warehouse
      const lotsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: inventoryLots.id,
            lotNumber: inventoryLots.lotNumber,
            itemId: inventoryLots.itemId,
            itemCode: items.code,
            itemName: items.nameTh,
            itemNameEn: items.nameEn,
            itemType: items.type,
            quantity: inventoryLots.quantity,
            unit: items.primaryUnit,
            status: inventoryLots.status,
            expiryDate: inventoryLots.expiryDate,
            receivedDate: inventoryLots.receivedDate,
          })
          .from(inventoryLots)
          .leftJoin(items, eq(inventoryLots.itemId, items.id))
          .where(eq(inventoryLots.warehouseId, parseInt(id)));
      });

      // Get recent transactions for this warehouse (from or to)
      const transactionsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: transactions.id,
            transactionType: transactions.transactionType,
            lotId: transactions.lotId,
            quantity: transactions.quantity,
            unit: transactions.unit,
            referenceType: transactions.referenceType,
            referenceNumber: transactions.referenceNumber,
            reason: transactions.reason,
            createdAt: transactions.createdAt,
          })
          .from(transactions)
          .where(
            or(
              eq(transactions.fromWarehouseId, parseInt(id)),
              eq(transactions.toWarehouseId, parseInt(id))
            )
          )
          .orderBy(sql`${transactions.createdAt} DESC`)
          .limit(20);
      });

      // Calculate summary statistics
      const totalLots = lotsResult.length;
      const totalQuantity = lotsResult.reduce((sum: number, lot: { quantity?: number }) => sum + (lot.quantity || 0), 0);
      const quarantineLots = lotsResult.filter((lot: { status?: string }) => lot.status === 'quarantine').length;
      const releasedLots = lotsResult.filter((lot: { status?: string }) => lot.status === 'released').length;
      const rejectedLots = lotsResult.filter((lot: { status?: string }) => lot.status === 'rejected').length;
      const nearExpiryLots = lotsResult.filter((lot: { expiryDate?: string | Date | null }) => {
        if (!lot.expiryDate) return false;
        const expiry = new Date(lot.expiryDate);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      }).length;

      // Group inventory by item type
      const inventoryByType: Record<string, { count: number; quantity: number }> = {};
      lotsResult.forEach((lot: { itemType?: string; quantity?: number }) => {
        const type = lot.itemType || 'other';
        if (!inventoryByType[type]) {
          inventoryByType[type] = { count: 0, quantity: 0 };
        }
        inventoryByType[type].count += 1;
        inventoryByType[type].quantity += lot.quantity || 0;
      });

      // Calculate storage utilization using actual warehouse capacity (in lots/positions)
      const storageCapacity = Number(warehouse.capacity) || 0;
      const usedCapacity = totalLots;  // Number of lots, not sum of quantities
      const utilizationPercent = storageCapacity > 0
        ? Math.round((usedCapacity / storageCapacity) * 100)
        : 0;

      return NextResponse.json({
        success: true,
        data: {
          warehouse,
          summary: {
            totalLots,
            totalQuantity,
            quarantineLots,
            releasedLots,
            rejectedLots,
            nearExpiryLots,
            inventoryByType,
            storageCapacity,
            usedCapacity,
            utilizationPercent: Math.min(utilizationPercent, 100),
          },
          lots: lotsResult,
          recentTransactions: transactionsResult,
        },
      });
    } catch (error) {
      console.error('Error fetching warehouse details:', error);
      return serverErrorResponse(error);
    }
  });
}
