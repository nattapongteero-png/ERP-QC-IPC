import { NextRequest } from 'next/server';
import { eq, sql, and } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { getDashboardModuleKpis } from '@/lib/services/dashboard.service';

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

        // Lots expiring in 30 days
        executeDbOperation(async (db) => {
          const result = await db
            .select({ count: sql`count(*)` })
            .from(lotsTable)
            .where(
              and(
                eq(lotsTable.status, 'released'),
                sql`${lotsTable.expiryDate} IS NOT NULL`
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
