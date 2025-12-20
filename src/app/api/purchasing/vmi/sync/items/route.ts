/**
 * VMI Items Sync API Routes
 *
 * GET /api/purchasing/vmi/sync/items - Get items pending sync for a vendor
 * POST /api/purchasing/vmi/sync/items - Sync items to VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVendors,
  sqliteVMIVendorConfig,
  sqliteItems,
  sqliteVMITransactions,
  mysqlVendors,
  mysqlVMIVendorConfig,
  mysqlItems,
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
import type { VmiTransactionType, VmiItem } from '@/types/vmi';

// GET /api/purchasing/vmi/sync/items - Get items pending sync for a vendor
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
      const vendors = isSqlite ? sqliteVendors : mysqlVendors;

      // Verify vendor has VMI configuration
      const configResult = await db
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      // Get vendor info
      const vendorResult = await db
        .select({ name: vendors.name })
        .from(vendors)
        .where(eq(vendors.id, vendorId));

      const vendorName = vendorResult[0]?.name || 'Unknown';

      // Get items with TPP or TTMT codes that belong to this vendor's approved list
      // For now, get all items with codes - can be filtered by AVL later
      const itemsResult = await db
        .select({
          id: items.id,
          code: items.code,
          name: items.name,
          tppCode: items.tppCode,
          ttmtCode: items.ttmtCode,
          primaryUnit: items.primaryUnit,
          updatedAt: items.updatedAt,
        })
        .from(items)
        .where(
          and(
            eq(items.isActive, true),
            or(isNotNull(items.tppCode), isNotNull(items.ttmtCode))
          )
        );

      // Determine which items need sync
      // An item needs sync if:
      // 1. It has never been synced (config.lastItemsSyncAt is null)
      // 2. It was updated after the last sync
      const lastSyncAt = config.lastItemsSyncAt ? new Date(config.lastItemsSyncAt) : null;

      const pendingItems = itemsResult.map((item) => {
        const updatedAt = item.updatedAt ? new Date(item.updatedAt) : null;
        const needsSync = !lastSyncAt || (updatedAt && updatedAt > lastSyncAt);

        return {
          id: item.id,
          code: item.code,
          name: item.name,
          tppCode: item.tppCode,
          ttmtCode: item.ttmtCode,
          unit: item.primaryUnit,
          updatedAt: item.updatedAt,
          needsSync,
        };
      });

      const pendingCount = pendingItems.filter((i) => i.needsSync).length;

      return successResponse({
        vendorId,
        vendorName,
        items: pendingItems,
        total: pendingItems.length,
        pendingCount,
        lastSyncAt: config.lastItemsSyncAt,
        syncEnabled: config.syncItemsEnabled,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/vmi/sync/items - Sync items to VMI Portal
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

      // Get items to sync
      let itemsToSync;
      if (itemIds && itemIds.length > 0) {
        // Sync specific items
        itemsToSync = await db
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

        // Filter by requested IDs
        itemsToSync = itemsToSync.filter((item) => itemIds.includes(item.id));
      } else {
        // Sync all items with codes
        itemsToSync = await db
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
      }

      if (itemsToSync.length === 0) {
        return successResponse(
          { vendorId, synced: 0, failed: 0, errors: [] },
          'No items to sync'
        );
      }

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

      // Prepare items for VMI Portal
      const vmiItems: VmiItem[] = itemsToSync.map((item) => ({
        tppCode: item.tppCode || undefined,
        ttmtCode: item.ttmtCode || undefined,
        name: item.name,
        unit: item.primaryUnit || 'unit',
        vendorItemCode: item.code,
      }));

      try {
        // Sync items to VMI Portal
        const result = await service.syncItems(vmiItems);

        const now = new Date();

        // Update last sync time
        await db
          .update(vmiConfig)
          .set({
            lastItemsSyncAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vmiConfig.vendorId, vendorId));

        // Create audit log
        await createAuditLog({
          userId: session.userId,
          action: 'SYNC',
          tableName: 'items',
          recordId: vendorId,
          newValue: {
            type: 'vmi_items_sync',
            synced: result.synced,
            failed: result.failed,
            itemCount: itemsToSync.length,
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
          `Successfully synced ${result.synced} items to VMI Portal`
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
