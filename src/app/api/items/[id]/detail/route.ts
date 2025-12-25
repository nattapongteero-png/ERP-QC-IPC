import { NextRequest, NextResponse } from 'next/server';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { eq, sql } from 'drizzle-orm';
import { withAuth, serverErrorResponse } from '@/lib/api-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async () => {
    try {
      const { id } = await params;
      const itemId = parseInt(id);

      const itemsTable = getTableRef('items');
      const inventoryLotsTable = getTableRef('inventoryLots');
      const warehousesTable = getTableRef('warehouses');
      const bomTable = getTableRef('bom');
      const bomLinesTable = getTableRef('bomLines');
      const workOrdersTable = getTableRef('workOrders');

      // Get item details
      const itemResult = await executeDbOperation(async (db) => {
        return db.select().from(itemsTable).where(eq(itemsTable.id, itemId));
      });

      if (itemResult.length === 0) {
        return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
      }

      const item = itemResult[0];

      // Get inventory lots for this item
      const lotsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: inventoryLotsTable.id,
            lotNumber: inventoryLotsTable.lotNumber,
            quantity: inventoryLotsTable.quantity,
            status: inventoryLotsTable.status,
            expiryDate: inventoryLotsTable.expiryDate,
            receivedDate: inventoryLotsTable.receivedDate,
            warehouseId: inventoryLotsTable.warehouseId,
            warehouseCode: warehousesTable.code,
            warehouseName: warehousesTable.name,
          })
          .from(inventoryLotsTable)
          .leftJoin(warehousesTable, eq(inventoryLotsTable.warehouseId, warehousesTable.id))
          .where(eq(inventoryLotsTable.itemId, itemId));
      });

      // Get BOM that produces this item (if this item is a finished product)
      const bomResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: bomTable.id,
            code: bomTable.code,
            name: bomTable.name,
            version: bomTable.version,
            status: bomTable.status,
            batchSize: bomTable.batchSize,
            batchUnit: bomTable.batchUnit,
          })
          .from(bomTable)
          .where(eq(bomTable.productId, itemId));
      });

      // Get BOM lines for each BOM (components)
      const bomWithLines = await Promise.all(
        bomResult.map(async (b: Record<string, unknown>) => {
          const lines = await executeDbOperation(async (db) => {
            return db
              .select({
                id: bomLinesTable.id,
                itemId: bomLinesTable.itemId,
                itemCode: itemsTable.code,
                itemName: itemsTable.nameTh,
                itemNameEn: itemsTable.nameEn,
                quantity: bomLinesTable.quantity,
                unit: bomLinesTable.unit,
                sequence: bomLinesTable.sequence,
              })
              .from(bomLinesTable)
              .leftJoin(itemsTable, eq(bomLinesTable.itemId, itemsTable.id))
              .where(eq(bomLinesTable.bomId, b.id as number));
          });
          return { ...b, lines };
        })
      );

      // Get items that use this item as a component (where used)
      const whereUsedResult = await executeDbOperation(async (db) => {
        return db
          .select({
            bomLineId: bomLinesTable.id,
            bomId: bomLinesTable.bomId,
            bomCode: bomTable.code,
            bomName: bomTable.name,
            productId: bomTable.productId,
            quantity: bomLinesTable.quantity,
            unit: bomLinesTable.unit,
          })
          .from(bomLinesTable)
          .leftJoin(bomTable, eq(bomLinesTable.bomId, bomTable.id))
          .where(eq(bomLinesTable.itemId, itemId));
      });

      // Enrich where used with product info
      const whereUsedWithProduct = await Promise.all(
        whereUsedResult.map(async (wu: Record<string, unknown>) => {
          const productResult = await executeDbOperation(async (db) => {
            return db
              .select({
                code: itemsTable.code,
                nameTh: itemsTable.nameTh,
                nameEn: itemsTable.nameEn,
              })
              .from(itemsTable)
              .where(eq(itemsTable.id, wu.productId as number));
          });
          return {
            ...wu,
            productCode: productResult[0]?.code,
            productName: productResult[0]?.nameTh,
            productNameEn: productResult[0]?.nameEn,
          };
        })
      );

      // Get recent work orders for this item
      const workOrdersResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: workOrdersTable.id,
            woNumber: workOrdersTable.woNumber,
            plannedQuantity: workOrdersTable.plannedQuantity,
            actualQuantity: workOrdersTable.actualQuantity,
            status: workOrdersTable.status,
            plannedStartDate: workOrdersTable.plannedStartDate,
            actualEndDate: workOrdersTable.actualEndDate,
          })
          .from(workOrdersTable)
          .where(eq(workOrdersTable.productId, itemId))
          .orderBy(sql`${workOrdersTable.createdAt} DESC`)
          .limit(10);
      });

      // Calculate stock summary
      const totalStock = lotsResult.reduce((sum: number, lot: Record<string, unknown>) => sum + ((lot.quantity as number) || 0), 0);
      const availableStock = lotsResult
        .filter((lot: Record<string, unknown>) => lot.status === 'released')
        .reduce((sum: number, lot: Record<string, unknown>) => sum + ((lot.quantity as number) || 0), 0);
      const quarantineStock = lotsResult
        .filter((lot: Record<string, unknown>) => lot.status === 'quarantine')
        .reduce((sum: number, lot: Record<string, unknown>) => sum + ((lot.quantity as number) || 0), 0);
      const rejectedStock = lotsResult
        .filter((lot: Record<string, unknown>) => lot.status === 'rejected')
        .reduce((sum: number, lot: Record<string, unknown>) => sum + ((lot.quantity as number) || 0), 0);

      // Calculate near expiry
      const now = new Date();
      const nearExpiryLots = lotsResult.filter((lot: Record<string, unknown>) => {
        if (!lot.expiryDate) return false;
        const expiry = new Date(lot.expiryDate as string);
        const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      });

      // Stock by warehouse
      const stockByWarehouse: Record<string, { code: string; name: string; quantity: number }> = {};
      lotsResult.forEach((lot: Record<string, unknown>) => {
        const key = lot.warehouseId?.toString() || 'unknown';
        if (!stockByWarehouse[key]) {
          stockByWarehouse[key] = {
            code: (lot.warehouseCode as string) || 'Unknown',
            name: (lot.warehouseName as string) || 'Unknown',
            quantity: 0,
          };
        }
        stockByWarehouse[key].quantity += (lot.quantity as number) || 0;
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
          bom: bomWithLines,
          whereUsed: whereUsedWithProduct,
          recentWorkOrders: workOrdersResult,
        },
      });
    } catch (error) {
      console.error('Error fetching item details:', error);
      return serverErrorResponse(error);
    }
  });
}
