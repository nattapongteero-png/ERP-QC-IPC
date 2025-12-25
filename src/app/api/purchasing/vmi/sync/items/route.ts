/**
 * VMI Items Sync API Routes
 *
 * GET /api/purchasing/vmi/sync/items - Get items pending sync for a vendor
 * POST /api/purchasing/vmi/sync/items - Sync items to VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
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

      const vmiConfig = getTableRef('vMIVendorConfig');
      const items = getTableRef('items');
      const vendors = getTableRef('vendors');

      // Verify vendor has VMI configuration
      const configResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vmiConfig)
          .where(eq(vmiConfig.vendorId, vendorId));
      });

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      // Get vendor info
      const vendorResult = await executeDbOperation(async (db) => {
        return db
          .select({ name: vendors.name })
          .from(vendors)
          .where(eq(vendors.id, vendorId));
      });

      const vendorName = vendorResult[0]?.name || 'Unknown';

      // Get items with TPP or TTMT codes that belong to this vendor's approved list
      // For now, get all items with codes - can be filtered by AVL later
      const itemsResult = await executeDbOperation(async (db) => {
        return db
          .select({
            id: items.id,
            code: items.code,
            nameTh: items.nameTh,
            nameEn: items.nameEn,
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
      });

      // Determine which items need sync
      // An item needs sync if:
      // 1. It has never been synced (config.lastItemsSyncAt is null)
      // 2. It was updated after the last sync
      const lastSyncAt = config.lastItemsSyncAt ? new Date(config.lastItemsSyncAt) : null;

      type ItemResultType = typeof itemsResult[number];
      const pendingItems = itemsResult.map((item: ItemResultType) => {
        const updatedAt = item.updatedAt ? new Date(item.updatedAt as string) : null;
        const needsSync = !lastSyncAt || (updatedAt && updatedAt > lastSyncAt);

        return {
          id: item.id,
          code: item.code,
          name: item.nameEn || item.nameTh,
          tppCode: item.tppCode,
          ttmtCode: item.ttmtCode,
          unit: item.primaryUnit,
          updatedAt: item.updatedAt,
          needsSync,
        };
      });

      const pendingCount = pendingItems.filter((i: { needsSync: boolean }) => i.needsSync).length;

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

      const vmiConfig = getTableRef('vMIVendorConfig');
      const items = getTableRef('items');
      const vmiTransactions = getTableRef('vMITransactions');

      // Get vendor config
      const configResult = await executeDbOperation(async (db) => {
        return db
          .select()
          .from(vmiConfig)
          .where(eq(vmiConfig.vendorId, vendorId));
      });

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];

      if (!config.isConnected) {
        return errorResponse('VMI Portal is not connected. Please test connection first.');
      }

      // Get items to sync
      let itemsToSync = await executeDbOperation(async (db) => {
        return db
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
      });

      // Filter by requested IDs if provided
      if (itemIds && itemIds.length > 0) {
        itemsToSync = itemsToSync.filter((item: { id: number }) => itemIds.includes(item.id));
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
          await executeDbOperation(async (db) => {
            return db.insert(vmiTransactions).values({
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
              createdAt: dbDate(),
            });
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
      type ItemToSyncType = { id: number; code: string; nameTh: string; nameEn: string | null; tppCode: string | null; ttmtCode: string | null; primaryUnit: string };
      const vmiItems: VmiItem[] = itemsToSync.map((item: ItemToSyncType) => ({
        localCode: item.code,  // Required by VMI Portal API
        name: item.nameEn || item.nameTh,
        unit: item.primaryUnit || 'unit',
        packUnit: item.primaryUnit || 'unit',  // Required by VMI Portal API
        tppCode: item.tppCode || undefined,
        ttmtCode: item.ttmtCode || undefined,
      }));

      try {
        // Sync items to VMI Portal
        const result = await service.syncItems(vmiItems);

        const now = new Date();

        // Update last sync time
        await executeDbOperation(async (db) => {
          return db
            .update(vmiConfig)
            .set({
              lastItemsSyncAt: dbDate(),
              updatedAt: dbDate(),
            })
            .where(eq(vmiConfig.vendorId, vendorId));
        });

        const syncedCount = result.summary.updated + result.summary.inserted;
        const failedCount = result.summary.failed;

        // Create audit log
        await createAuditLog({
          userId: session.userId,
          action: 'SYNC',
          tableName: 'items',
          recordId: vendorId,
          newValue: {
            type: 'vmi_items_sync',
            synced: syncedCount,
            failed: failedCount,
            itemCount: itemsToSync.length,
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
          `Successfully synced ${syncedCount} items to VMI Portal`
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
