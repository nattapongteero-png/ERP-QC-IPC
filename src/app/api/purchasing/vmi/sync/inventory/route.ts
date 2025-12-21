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
import type { VmiTransactionType, VmiInventoryPayload } from '@/types/vmi';

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
      const configResult = await db
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      // Get items with TPP or TTMT codes
      const vmiItems = await db
        .select({
          id: items.id,
          code: items.code,
          name: items.name,
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
      const inventoryData = await Promise.all(
        vmiItems.map(async (item) => {
          // Get total available quantity from inventory lots
          const lotsResult = await db
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
            itemName: item.name,
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
      const configResult = await db
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
      let vmiItems = await db
        .select({
          id: items.id,
          code: items.code,
          name: items.name,
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
        vmiItems = vmiItems.filter((item) => itemIds.includes(item.id));
      }

      if (vmiItems.length === 0) {
        return successResponse(
          { vendorId, synced: 0, failed: 0, errors: [] },
          'No VMI items to sync'
        );
      }

      // Calculate inventory for each item
      const inventoryPayloads: VmiInventoryPayload[] = await Promise.all(
        vmiItems.map(async (item) => {
          const lotsResult = await db
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
            tppCode: item.tppCode || undefined,
            ttmtCode: item.ttmtCode || undefined,
            availableQuantity,
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
          await db.insert(vmiTransactions).values({
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
        await db
          .update(vmiConfig)
          .set({
            lastInventorySyncAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vmiConfig.vendorId, vendorId));

        // Create audit log
        await createAuditLog({
          userId: session.userId,
          action: 'SYNC',
          tableName: 'inventory_lots',
          recordId: vendorId,
          newValue: {
            type: 'vmi_inventory_sync',
            synced: result.synced,
            failed: result.failed,
            itemCount: vmiItems.length,
          },
          ipAddress: getClientIP(request),
        });

        return successResponse(
          {
            vendorId,
            synced: result.synced,
            failed: result.failed,
            errors: result.errors || [],
            syncedAt: now.toISOString(),
          },
          `Successfully synced inventory for ${result.synced} items to VMI Portal`
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
