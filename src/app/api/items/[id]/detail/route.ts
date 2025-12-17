import { NextRequest, NextResponse } from 'next/server';
import { getDb, useSqlite } from '@/lib/db';
import { 
  sqliteItems, sqliteInventoryLots, sqliteWarehouses, sqliteBom, sqliteWorkOrders,
  mysqlItems, mysqlInventoryLots, mysqlWarehouses, mysqlBom, mysqlWorkOrders
} from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (user) => {
    try {
      const { id } = await params;
      const db = await getDb();
      const items = useSqlite() ? sqliteItems : mysqlItems;
      const inventoryLots = useSqlite() ? sqliteInventoryLots : mysqlInventoryLots;
      const warehouses = useSqlite() ? sqliteWarehouses : mysqlWarehouses;
      const bom = useSqlite() ? sqliteBom : mysqlBom;
      const workOrders = useSqlite() ? sqliteWorkOrders : mysqlWorkOrders;

      // Get item details
      const itemResult = await db.select().from(items).where(eq(items.id, parseInt(id)));
      
      if (itemResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
      }

      const item = itemResult[0];

      // Get inventory lots for this item
      const lotsResult = await db
        .select({
          id: inventoryLots.id,
          lotNumber: inventoryLots.lotNumber,
          quantity: inventoryLots.quantity,
          status: inventoryLots.status,
          expiryDate: inventoryLots.expiryDate,
          receivedDate: inventoryLots.receivedDate,
          warehouseId: inventoryLots.warehouseId,
          warehouseCode: warehouses.code,
          warehouseName: warehouses.name,
        })
        .from(inventoryLots)
        .leftJoin(warehouses, eq(inventoryLots.warehouseId, warehouses.id))
        .where(eq(inventoryLots.itemId, parseInt(id)));

      // Get BOM components (if this item is a finished product)
      const bomResult = await db
        .select({
          id: bom.id,
          componentId: bom.componentId,
          componentCode: items.code,
          componentName: items.nameTh,
          componentNameEn: items.nameEn,
          quantity: bom.quantity,
          unit: items.unit,
          lossPercent: bom.lossPercent,
        })
        .from(bom)
        .leftJoin(items, eq(bom.componentId, items.id))
        .where(eq(bom.productId, parseInt(id)));

      // Get items that use this item as a component (where used)
      const whereUsedResult = await db
        .select({
          id: bom.id,
          productId: bom.productId,
          productCode: items.code,
          productName: items.nameTh,
          productNameEn: items.nameEn,
          quantity: bom.quantity,
        })
        .from(bom)
        .leftJoin(items, eq(bom.productId, items.id))
        .where(eq(bom.componentId, parseInt(id)));

      // Get recent work orders for this item
      const workOrdersResult = await db
        .select({
          id: workOrders.id,
          woNumber: workOrders.woNumber,
          plannedQty: workOrders.plannedQty,
          actualQty: workOrders.actualQty,
          status: workOrders.status,
          plannedStartDate: workOrders.plannedStartDate,
          actualEndDate: workOrders.actualEndDate,
        })
        .from(workOrders)
        .where(eq(workOrders.productId, parseInt(id)))
        .orderBy(sql`${workOrders.createdAt} DESC`)
        .limit(10);

      // Calculate stock summary
      const totalStock = lotsResult.reduce((sum: number, lot: any) => sum + (lot.quantity || 0), 0);
      const availableStock = lotsResult
        .filter((lot: any) => lot.status === 'released')
        .reduce((sum: number, lot: any) => sum + (lot.quantity || 0), 0);
      const quarantineStock = lotsResult
        .filter((lot: any) => lot.status === 'quarantine')
        .reduce((sum: number, lot: any) => sum + (lot.quantity || 0), 0);
      const rejectedStock = lotsResult
        .filter((lot: any) => lot.status === 'rejected')
        .reduce((sum: number, lot: any) => sum + (lot.quantity || 0), 0);

      // Calculate near expiry
      const now = new Date();
      const nearExpiryLots = lotsResult.filter((lot: any) => {
        if (!lot.expiryDate) return false;
        const expiry = new Date(lot.expiryDate);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      });

      // Stock by warehouse
      const stockByWarehouse: Record<string, { code: string; name: string; quantity: number }> = {};
      lotsResult.forEach((lot: any) => {
        const key = lot.warehouseId?.toString() || 'unknown';
        if (!stockByWarehouse[key]) {
          stockByWarehouse[key] = {
            code: lot.warehouseCode || 'Unknown',
            name: lot.warehouseName || 'Unknown',
            quantity: 0,
          };
        }
        stockByWarehouse[key].quantity += lot.quantity || 0;
      });

      return NextResponse.json({
        success: true,
        data: {
          item,
          stockSummary: {
            totalStock,
            availableStock,
            quarantineStock,
            rejectedStock,
            nearExpiryCount: nearExpiryLots.length,
            lotCount: lotsResult.length,
          },
          stockByWarehouse: Object.values(stockByWarehouse),
          lots: lotsResult,
          bom: bomResult,
          whereUsed: whereUsedResult,
          recentWorkOrders: workOrdersResult,
        },
      });
    } catch (error) {
      console.error('Error fetching item details:', error);
      return serverErrorResponse(error);
    }
  });
}
