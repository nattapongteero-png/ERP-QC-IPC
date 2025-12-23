/**
 * VMI Dashboard API Routes
 *
 * GET /api/purchasing/vmi/dashboard - Get VMI dashboard overview data
 */

import { NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { getTableRef, executeDbOperation } from '@/lib/db/db-helper';
import {
  successResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';

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

      const vmiConfig = getTableRef('vMIVendorConfig');
      const vendors = getTableRef('vendors');
      const vmiOrders = getTableRef('vMIOrders');
      const items = getTableRef('items');

      // Get all VMI vendor configs with vendor info
      const vendorConfigs = await executeDbOperation(async (db) => {
        return db
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
          })
          .from(vmiConfig)
          .innerJoin(vendors, eq(vmiConfig.vendorId, vendors.id));
      });

      // Filter by vendor if specified
      const filteredConfigs = vendorIdStr
        ? vendorConfigs.filter((c: { vendorId: number }) => c.vendorId === parseInt(vendorIdStr))
        : vendorConfigs;

      // Get item sync stats - count items with VMI sync enabled
      const itemStats = await executeDbOperation(async (db) => {
        return db
          .select({ count: sql<number>`count(*)` })
          .from(items)
          .where(eq(items.vmiSyncEnabled, true));
      });

      const totalVmiItems = Number(itemStats[0]?.count || 0);

      // Aggregate transaction stats
      const transactionStats = {
        total: 0,
        pending: 0,
        completed: 0,
        failed: 0,
      };

      const orderStats = await executeDbOperation(async (db) => {
        return db
          .select({
            status: vmiOrders.status,
            count: sql<number>`count(*)`,
          })
          .from(vmiOrders)
          .groupBy(vmiOrders.status);
      });

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
          return 'synced';
        };

        return {
          vendorId: config.vendorId,
          vendorName: config.vendorName || 'Unknown',
          isConnected: !!config.isConnected,
          itemsSync: {
            enabled: !!config.syncItemsEnabled,
            lastSyncAt: config.lastItemsSyncAt?.toString() || null,
            pendingCount: 0,
            status: determineSyncStatus(!!config.syncItemsEnabled, config.lastItemsSyncAt),
          },
          pricesSync: {
            enabled: !!config.syncPricesEnabled,
            lastSyncAt: config.lastPricesSyncAt?.toString() || null,
            pendingCount: 0,
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
