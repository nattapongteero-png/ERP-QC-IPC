/**
 * VMI Dashboard API Routes
 *
 * GET /api/purchasing/vmi/dashboard - Get VMI dashboard overview data
 */

import { NextRequest } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVMIVendorConfig,
  sqliteVendors,
  sqliteVMITransactions,
  sqliteVMIOrders,
  sqliteItems,
  mysqlVMIVendorConfig,
  mysqlVendors,
  mysqlVMITransactions,
  mysqlVMIOrders,
  mysqlItems,
} from '@/lib/db/schema';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { or, isNotNull } from 'drizzle-orm';

interface VendorSyncStatus {
  vendorId: number;
  vendorName: string;
  isConnected: boolean;
  itemsSync: {
    enabled: boolean;
    lastSyncAt: string | null;
    pendingCount: number;
    status: 'synced' | 'partial' | 'pending' | 'error' | 'never' | 'disabled';
  };
  pricesSync: {
    enabled: boolean;
    lastSyncAt: string | null;
    pendingCount: number;
    status: 'synced' | 'partial' | 'pending' | 'error' | 'never' | 'disabled';
  };
  inventorySync: {
    enabled: boolean;
    lastSyncAt: string | null;
    status: 'synced' | 'partial' | 'pending' | 'error' | 'never' | 'disabled';
  };
}

// GET /api/purchasing/vmi/dashboard - Get VMI dashboard overview data
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const vendorIdStr = searchParams.get('vendorId');

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;
      const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;
      const vmiOrders = isSqlite ? sqliteVMIOrders : mysqlVMIOrders;
      const items = isSqlite ? sqliteItems : mysqlItems;

      // Get all VMI vendor configs with vendor info
      const vendorConfigsQuery = db
        .select({
          vendorId: vmiConfig.vendorId,
          vendorName: vendors.name,
          isConnected: vmiConfig.isConnected,
          syncItemsEnabled: vmiConfig.syncItemsEnabled,
          syncPricesEnabled: vmiConfig.syncPricesEnabled,
          syncInventoryEnabled: vmiConfig.syncInventoryEnabled,
          lastItemsSyncAt: vmiConfig.lastItemsSyncAt,
          lastPricesSyncAt: vmiConfig.lastPricesSyncAt,
          lastInventorySyncAt: vmiConfig.lastInventorySyncAt,
          lastOrdersPollAt: vmiConfig.lastOrdersPollAt,
          createdAt: vmiConfig.createdAt,
        })
        .from(vmiConfig)
        .innerJoin(vendors, eq(vmiConfig.vendorId, vendors.id));

      const vendorConfigs = await vendorConfigsQuery;

      // Filter by vendor if specified
      const filteredConfigs = vendorIdStr
        ? vendorConfigs.filter((c: { vendorId: number }) => c.vendorId === parseInt(vendorIdStr))
        : vendorConfigs;

      // Get total VMI items count
      const vmiItemsResult = await (db as any)
        .select({ count: sql<number>`count(*)` })
        .from(items)
        .where(
          and(
            eq(items.isActive, true),
            or(isNotNull(items.tppCode), isNotNull(items.ttmtCode))
          )
        );
      const totalVmiItems = Number(vmiItemsResult[0]?.count || 0);

      // Get recent transactions (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentTransactions = await (db as any)
        .select({
          transactionType: vmiTransactions.transactionType,
          status: vmiTransactions.status,
          count: sql<number>`count(*)`,
        })
        .from(vmiTransactions)
        .where(
          sql`${vmiTransactions.createdAt} >= ${isSqlite ? oneDayAgo.toISOString() : oneDayAgo}`
        )
        .groupBy(vmiTransactions.transactionType, vmiTransactions.status);

      // Aggregate transaction stats
      const transactionStats = {
        total: 0,
        success: 0,
        error: 0,
        byType: {} as Record<string, { success: number; error: number }>,
      };

      recentTransactions.forEach((t: { transactionType: string; status: string; count: number }) => {
        const count = Number(t.count);
        transactionStats.total += count;
        if (t.status === 'success') {
          transactionStats.success += count;
        } else if (t.status === 'error') {
          transactionStats.error += count;
        }

        if (!transactionStats.byType[t.transactionType]) {
          transactionStats.byType[t.transactionType] = { success: 0, error: 0 };
        }
        if (t.status === 'success') {
          transactionStats.byType[t.transactionType].success += count;
        } else if (t.status === 'error') {
          transactionStats.byType[t.transactionType].error += count;
        }
      });

      // Get order stats
      const orderStats = await (db as any)
        .select({
          status: vmiOrders.status,
          count: sql<number>`count(*)`,
        })
        .from(vmiOrders)
        .groupBy(vmiOrders.status);

      const orderSummary = {
        total: 0,
        byStatus: {} as Record<string, number>,
      };

      orderStats.forEach((o: { status: string; count: number }) => {
        const count = Number(o.count);
        orderSummary.total += count;
        orderSummary.byStatus[o.status] = count;
      });

      // Build vendor sync status
      type ConfigType = typeof vendorConfigs[number];
      const vendorSyncStatuses: VendorSyncStatus[] = filteredConfigs.map((config: ConfigType) => {
        const determineSyncStatus = (
          enabled: boolean,
          lastSyncAt: unknown
        ): 'synced' | 'partial' | 'pending' | 'error' | 'never' | 'disabled' => {
          if (!enabled) return 'disabled';
          if (!lastSyncAt) return 'never';
          // For now, assume synced if last sync exists
          // In production, would check for pending items
          return 'synced';
        };

        return {
          vendorId: config.vendorId,
          vendorName: config.vendorName || 'Unknown',
          isConnected: !!config.isConnected,
          itemsSync: {
            enabled: !!config.syncItemsEnabled,
            lastSyncAt: config.lastItemsSyncAt?.toString() || null,
            pendingCount: 0, // Would calculate based on items modified after lastItemsSyncAt
            status: determineSyncStatus(!!config.syncItemsEnabled, config.lastItemsSyncAt),
          },
          pricesSync: {
            enabled: !!config.syncPricesEnabled,
            lastSyncAt: config.lastPricesSyncAt?.toString() || null,
            pendingCount: 0, // Would calculate based on offers modified after lastPricesSyncAt
            status: determineSyncStatus(!!config.syncPricesEnabled, config.lastPricesSyncAt),
          },
          inventorySync: {
            enabled: !!config.syncInventoryEnabled,
            lastSyncAt: config.lastInventorySyncAt?.toString() || null,
            status: determineSyncStatus(!!config.syncInventoryEnabled, config.lastInventorySyncAt),
          },
        };
      });

      // Calculate overall health
      const connectedVendors = filteredConfigs.filter((c: ConfigType) => c.isConnected).length;
      const totalVendors = filteredConfigs.length;
      const healthPercentage = totalVendors > 0 ? Math.round((connectedVendors / totalVendors) * 100) : 0;

      return successResponse({
        summary: {
          totalVendors,
          connectedVendors,
          disconnectedVendors: totalVendors - connectedVendors,
          healthPercentage,
          totalVmiItems,
        },
        transactions: transactionStats,
        orders: orderSummary,
        vendors: vendorSyncStatuses,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}
