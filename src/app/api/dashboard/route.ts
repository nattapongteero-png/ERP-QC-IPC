import { NextRequest } from 'next/server';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const db = await getDb();
      const useSqlite = process.env.DB_TYPE === 'sqlite';
      
      // Tables
      const itemsTable = useSqlite ? schema.sqliteItems : schema.mysqlItems;
      const lotsTable = useSqlite ? schema.sqliteInventoryLots : schema.mysqlInventoryLots;
      const workOrdersTable = useSqlite ? schema.sqliteWorkOrders : schema.mysqlWorkOrders;
      const poTable = useSqlite ? schema.sqlitePurchaseOrders : schema.mysqlPurchaseOrders;
      const soTable = useSqlite ? schema.sqliteSalesOrders : schema.mysqlSalesOrders;
      const deviationsTable = useSqlite ? schema.sqliteDeviations : schema.mysqlDeviations;
      
      // Get counts
      const [
        itemsCount,
        lotsInQuarantine,
        lotsExpiringSoon,
        activeWorkOrders,
        pendingPOs,
        pendingSOs,
        openDeviations,
      ] = await Promise.all([
        // Total active items
        (db as any)
          .select({ count: sql`count(*)` })
          .from(itemsTable)
          .where(eq(itemsTable.isActive, true))
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Lots in quarantine
        (db as any)
          .select({ count: sql`count(*)` })
          .from(lotsTable)
          .where(eq(lotsTable.status, 'quarantine'))
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Lots expiring in 30 days
        (db as any)
          .select({ count: sql`count(*)` })
          .from(lotsTable)
          .where(
            and(
              eq(lotsTable.status, 'released'),
              sql`${lotsTable.expiryDate} IS NOT NULL`
            )
          )
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Active work orders (in_progress)
        (db as any)
          .select({ count: sql`count(*)` })
          .from(workOrdersTable)
          .where(eq(workOrdersTable.status, 'in_progress'))
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Pending purchase orders
        (db as any)
          .select({ count: sql`count(*)` })
          .from(poTable)
          .where(eq(poTable.status, 'draft'))
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Pending sales orders
        (db as any)
          .select({ count: sql`count(*)` })
          .from(soTable)
          .where(eq(soTable.status, 'draft'))
          .then((r: any) => Number(r[0]?.count || 0)),
        
        // Open deviations
        (db as any)
          .select({ count: sql`count(*)` })
          .from(deviationsTable)
          .where(eq(deviationsTable.status, 'open'))
          .then((r: any) => Number(r[0]?.count || 0)),
      ]);
      
      // Get recent work orders
      const recentWorkOrders = await (db as any)
        .select({
          id: workOrdersTable.id,
          woNumber: workOrdersTable.woNumber,
          batchNumber: workOrdersTable.batchNumber,
          status: workOrdersTable.status,
          plannedQuantity: workOrdersTable.plannedQuantity,
          unit: workOrdersTable.unit,
          createdAt: workOrdersTable.createdAt,
        })
        .from(workOrdersTable)
        .orderBy(sql`${workOrdersTable.createdAt} DESC`)
        .limit(5);
      
      // Get inventory by status
      const inventoryByStatus = await (db as any)
        .select({
          status: lotsTable.status,
          count: sql`count(*)`,
          totalQuantity: sql`sum(${lotsTable.quantity})`,
        })
        .from(lotsTable)
        .groupBy(lotsTable.status);
      
      // Get work orders by status
      const workOrdersByStatus = await (db as any)
        .select({
          status: workOrdersTable.status,
          count: sql`count(*)`,
        })
        .from(workOrdersTable)
        .groupBy(workOrdersTable.status);
      
      return successResponse({
        summary: {
          totalItems: itemsCount,
          lotsInQuarantine,
          lotsExpiringSoon,
          activeWorkOrders,
          pendingPOs,
          pendingSOs,
          openDeviations,
        },
        recentWorkOrders,
        inventoryByStatus,
        workOrdersByStatus,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['reports:read']);
}
