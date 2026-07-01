import { NextRequest } from 'next/server';
import { eq, sql, and, gte, lte, lt, ne } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import { toQueryDate, getTodayStr } from '@/lib/db/date-utils';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDashboardModuleKpis } from '@/lib/services/dashboard.service';

/**
 * Sum the value of non-draft, non-cancelled sales orders whose orderDate
 * falls within [start, end). Used for the monthly-growth KPI — real data,
 * never a hardcoded figure.
 */
async function sumSalesInRange(start: Date, end: Date): Promise<number> {
  const soTable = getTableRef('salesOrders');
  return executeDbOperation(async (db) => {
    const result = await db
      .select({ total: sql`COALESCE(SUM(${soTable.totalAmount}), 0)` })
      .from(soTable)
      .where(
        and(
          ne(soTable.status, 'draft'),
          ne(soTable.status, 'cancelled'),
          sql`${soTable.orderDate} IS NOT NULL`,
          gte(soTable.orderDate, toQueryDate(start)),
          lt(soTable.orderDate, toQueryDate(end))
        )
      );
    return Number(result[0]?.total || 0);
  });
}

// GET /api/dashboard - Get dashboard statistics
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      // Tables
      const itemsTable = getTableRef('items');
      const lotsTable = getTableRef('inventoryLots');
      const workOrdersTable = getTableRef('workOrders');
      const poTable = getTableRef('purchaseOrders');
      const soTable = getTableRef('salesOrders');
      const deviationsTable = getTableRef('deviations');
      const warehousesTable = getTableRef('warehouses');

      // Get counts and module KPIs
      const [
        itemsCount,
        lotsInQuarantine,
        lotsExpiringSoon,
        activeWorkOrders,
        pendingPOs,
        pendingSOs,
        openDeviations,
        moduleKpis,
      ] = await Promise.all([
        // Total active items
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(itemsTable)
            .where(eq(itemsTable.isActive, true));
          return Number(result[0]?.count || 0);
        }),

        // Lots in quarantine
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(lotsTable)
            .where(eq(lotsTable.status, 'quarantine'));
          return Number(result[0]?.count || 0);
        }),

        // Lots expiring within 30 days (released lots whose expiry date falls
        // between today and today+30). Matches the "ภายใน 30 วัน" UI label and
        // the audit dashboard's expiringSoon window — previously this counted
        // ALL released lots with an expiry date, inflating the number.
        executeDbOperation(async (db) => {
          const todayStr = getTodayStr();
          const thirtyDaysAhead = new Date();
          thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);
          const result = await db
            .select({ count: sql`count(*)` })
            .from(lotsTable)
            .where(
              and(
                eq(lotsTable.status, 'released'),
                sql`${lotsTable.expiryDate} IS NOT NULL`,
                gte(lotsTable.expiryDate, toQueryDate(todayStr)),
                lte(lotsTable.expiryDate, toQueryDate(thirtyDaysAhead))
              )
            );
          return Number(result[0]?.count || 0);
        }),

        // Active work orders (in_progress)
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(workOrdersTable)
            .where(eq(workOrdersTable.status, 'in_progress'));
          return Number(result[0]?.count || 0);
        }),

        // Pending purchase orders
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(poTable)
            .where(eq(poTable.status, 'draft'));
          return Number(result[0]?.count || 0);
        }),

        // Pending sales orders
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(soTable)
            .where(eq(soTable.status, 'draft'));
          return Number(result[0]?.count || 0);
        }),

        // Open deviations
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(deviationsTable)
            .where(eq(deviationsTable.status, 'open'));
          return Number(result[0]?.count || 0);
        }),

        // Module KPIs
        getDashboardModuleKpis(),
      ]);

      // Monthly sales growth: this calendar month vs last calendar month.
      // Computed from real sales-order values — null when there is no prior
      // month to compare against (so the UI shows "—" instead of a fake %).
      const now = new Date();
      const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const [thisMonthSales, lastMonthSales] = await Promise.all([
        sumSalesInRange(startThisMonth, startNextMonth),
        sumSalesInRange(startLastMonth, startThisMonth),
      ]);

      // Growth is only meaningful once BOTH months have real sales. When the
      // current month has no sales yet (start of month), a naive formula yields
      // a misleading -100% — treat that as "no data" (null → UI shows "—")
      // rather than implying the business collapsed.
      const monthlyGrowthPercent =
        lastMonthSales > 0 && thisMonthSales > 0
          ? ((thisMonthSales - lastMonthSales) / lastMonthSales) * 100
          : null;

      // Get recent work orders
      const recentWorkOrders = await executeDbOperation(async (db) => {
        return db
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
      });

      // Get inventory by status
      const inventoryByStatus = await executeDbOperation(async (db) => {
        return db
          .select({
            status: lotsTable.status,
            count: sql`count(*)`,
            totalQuantity: sql`sum(${lotsTable.quantity})`,
          })
          .from(lotsTable)
          .groupBy(lotsTable.status);
      });

      // Get work orders by status
      const workOrdersByStatus = await executeDbOperation(async (db) => {
        return db
          .select({
            status: workOrdersTable.status,
            count: sql`count(*)`,
          })
          .from(workOrdersTable)
          .groupBy(workOrdersTable.status);
      });

      // Get inventory by warehouse type
      const inventoryByWarehouseType = await executeDbOperation(async (db) => {
        return db
          .select({
            warehouseType: warehousesTable.type,
            warehouseName: warehousesTable.name,
            lotCount: sql`count(${lotsTable.id})`,
            totalQuantity: sql`COALESCE(sum(${lotsTable.quantity}), 0)`,
          })
          .from(warehousesTable)
          .leftJoin(lotsTable, eq(lotsTable.warehouseId, warehousesTable.id))
          .where(eq(warehousesTable.isActive, true))
          .groupBy(warehousesTable.type, warehousesTable.name)
          .orderBy(warehousesTable.type);
      });

      return successResponse({
        summary: {
          totalItems: itemsCount,
          lotsInQuarantine,
          lotsExpiringSoon,
          activeWorkOrders,
          pendingPOs,
          pendingSOs,
          openDeviations,
          thisMonthSales,
          lastMonthSales,
          monthlyGrowthPercent,
        },
        recentWorkOrders,
        inventoryByStatus,
        workOrdersByStatus,
        inventoryByWarehouseType,
        moduleKpis,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['reports:read']);
}
