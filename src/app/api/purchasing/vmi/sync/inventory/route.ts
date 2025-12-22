/**
 * VMI Inventory Sync API Routes
 *
 * GET /api/purchasing/vmi/sync/inventory - Get inventory for a vendor's VMI items
 * POST /api/purchasing/vmi/sync/inventory - Sync inventory to VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq, and, or, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVMIVendorConfig,
  sqliteItems,
  sqliteInventoryLots,
  sqliteVMITransactions,
  mysqlVMIVendorConfig,
  mysqlItems,
  mysqlInventoryLots,
  mysqlVMITransactions,
} from '@/lib/db/schema';
import {
  successResponse,
  errorResponse,
  serverErrorResponse,
  withAuth,
} from '@/lib/api-utils';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType, VmiInventoryItem } from '@/types/vmi';

// GET /api/purchasing/vmi/sync/inventory - Get inventory for a vendor's VMI items
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const vendorIdStr = searchParams.get('vendorId');

      if (!vendorIdStr) {
        return errorResponse('Vendor ID is required');
      }

      const vendorId = parseInt(vendorIdStr);
      if (isNaN(vendorId)) {
        return errorResponse('Invalid vendor ID');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite ? sqliteInventoryLots : mysqlInventoryLots;

      // Verify vendor has VMI configuration
      const configResult = await (db as any)
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      // Get items with TPP or TTMT codes
      const vmiItems = await (db as any)
        .select({
          id: items.id,
          code: items.code,
          nameTh: items.nameTh,
          nameEn: items.nameEn,
          tppCode: items.tppCode,
          ttmtCode: items.ttmtCode,
          primaryUnit: items.primaryUnit,
        })
        .from(items)
        .where(
          and(
            eq(items.isActive, true),
            or(isNotNull(items.tppCode), isNotNull(items.ttmtCode))
          )
        );

      // Get inventory for each item
      type VmiItemType = { id: number; code: string; nameTh: string; nameEn: string | null; tppCode: string | null; ttmtCode: string | null; primaryUnit: string };
      const inventoryData = await Promise.all(
        vmiItems.map(async (item: VmiItemType) => {
          // Get total available quantity from inventory lots
          const lotsResult = await (db as any)
            .select({
              totalQuantity: sql<number>`COALESCE(SUM(${inventoryLots.quantity}), 0)`,
              reservedQuantity: sql<number>`COALESCE(SUM(${inventoryLots.reservedQuantity}), 0)`,
            })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLots.itemId, item.id),
                eq(inventoryLots.status, 'available')
              )
            );

          const totalQuantity = Number(lotsResult[0]?.totalQuantity || 0);
          const reservedQuantity = Number(lotsResult[0]?.reservedQuantity || 0);
          const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);

          return {
            itemId: item.id,
            itemCode: item.code,
            itemName: item.nameEn || item.nameTh,
            tppCode: item.tppCode,
            ttmtCode: item.ttmtCode,
            unit: item.primaryUnit,
            totalQuantity,
            reservedQuantity,
            availableQuantity,
            hasStock: availableQuantity > 0,
          };
        })
      );

      const itemsWithStock = inventoryData.filter((i) => i.hasStock).length;
      const itemsWithZeroStock = inventoryData.filter((i) => !i.hasStock).length;

      return successResponse({
        vendorId,
        inventory: inventoryData,
        total: inventoryData.length,
        itemsWithStock,
        itemsWithZeroStock,
        lastSyncAt: config.lastInventorySyncAt,
        syncEnabled: config.syncInventoryEnabled,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/vmi/sync/inventory - Sync inventory to VMI Portal
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const { vendorId, itemIds } = body;

      if (!vendorId) {
        return errorResponse('Vendor ID is required');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const items = isSqlite ? sqliteItems : mysqlItems;
      const inventoryLots = isSqlite ? sqliteInventoryLots : mysqlInventoryLots;
      const vmiTransactions = isSqlite ? sqliteVMITransactions : mysqlVMITransactions;

      // Get vendor config
      const configResult = await (db as any)
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      if (!config.isConnected) {
        return errorResponse('VMI Portal is not connected. Please test connection first.');
      }

      // Get VMI items
      let vmiItems = await (db as any)
        .select({
          id: items.id,
          code: items.code,
          tppCode: items.tppCode,
          ttmtCode: items.ttmtCode,
          primaryUnit: items.primaryUnit,
        })
        .from(items)
        .where(
          and(
            eq(items.isActive, true),
            or(isNotNull(items.tppCode), isNotNull(items.ttmtCode))
          )
        );

      // Filter by requested IDs if provided
      if (itemIds && itemIds.length > 0) {
        vmiItems = vmiItems.filter((item: { id: number }) => itemIds.includes(item.id));
      }

      if (vmiItems.length === 0) {
        return successResponse(
          { vendorId, synced: 0, failed: 0, errors: [] },
          'No VMI items to sync'
        );
      }

      // Calculate inventory for each item
      type VmiItemPostType = { id: number; code: string; tppCode: string | null; ttmtCode: string | null; primaryUnit: string };
      const inventoryPayloads: VmiInventoryItem[] = await Promise.all(
        vmiItems.map(async (item: VmiItemPostType) => {
          const lotsResult = await (db as any)
            .select({
              totalQuantity: sql<number>`COALESCE(SUM(${inventoryLots.quantity}), 0)`,
              reservedQuantity: sql<number>`COALESCE(SUM(${inventoryLots.reservedQuantity}), 0)`,
            })
            .from(inventoryLots)
            .where(
              and(
                eq(inventoryLots.itemId, item.id),
                eq(inventoryLots.status, 'available')
              )
            );

          const totalQuantity = Number(lotsResult[0]?.totalQuantity || 0);
          const reservedQuantity = Number(lotsResult[0]?.reservedQuantity || 0);
          const availableQuantity = Math.max(0, totalQuantity - reservedQuantity);

          return {
            localCode: item.code,  // Required by VMI Portal API
            quantityAvailable: availableQuantity,  // Required by VMI Portal API
            unit: item.primaryUnit || 'unit',
          };
        })
      );

      // Create transaction logger
      const transactionLogger: VmiTransactionLogger = {
        async log(
          logVendorId: number,
          transactionType: VmiTransactionType,
          endpoint: string,
          method: string,
          requestPayload: unknown,
          responsePayload: unknown,
          httpStatus: number,
          durationMs: number,
          error?: string
        ) {
          const now = new Date();
          await (db as any).insert(vmiTransactions).values({
            vendorId: logVendorId,
            transactionType,
            endpoint,
            method,
            requestPayload: requestPayload ? JSON.stringify(requestPayload) : null,
            responsePayload: responsePayload ? JSON.stringify(responsePayload) : null,
            httpStatus,
            durationMs,
            status: error ? 'error' : 'success',
            errorMessage: error || null,
            createdAt: isSqlite ? now.toISOString() : now,
          });
        },
      };

      // Create service
      const service = new VmiPortalService({
        vendorId: config.vendorId,
        apiKeyEncrypted: config.apiKeyEncrypted,
        baseUrl: config.baseUrl || undefined,
        vmiVendorId: config.vmiVendorId || undefined,
      });
      service.setTransactionLogger(transactionLogger);

      try {
        // Sync inventory to VMI Portal
        const result = await service.syncInventory(inventoryPayloads);

        const now = new Date();

        // Update last sync time
        await (db as any)
          .update(vmiConfig)
          .set({
            lastInventorySyncAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vmiConfig.vendorId, vendorId));

        const syncedCount = result.summary.updated + result.summary.inserted;
        const failedCount = result.summary.failed;

        // Create audit log
        await createAuditLog({
          userId: session.userId,
          action: 'SYNC',
          tableName: 'inventory_lots',
          recordId: vendorId,
          newValue: {
            type: 'vmi_inventory_sync',
            synced: syncedCount,
            failed: failedCount,
            itemCount: vmiItems.length,
          },
          ipAddress: getClientIP(request),
        });

        return successResponse(
          {
            vendorId,
            synced: syncedCount,
            failed: failedCount,
            errors: result.errors || [],
            syncedAt: now.toISOString(),
          },
          `Successfully synced inventory for ${syncedCount} items to VMI Portal`
        );
      } catch (err) {
        if (err instanceof VmiPortalError) {
          return errorResponse(`VMI Portal error: ${err.getUserMessage('en')}`, err.httpStatus);
        }
        throw err;
      }
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:write']);
}
