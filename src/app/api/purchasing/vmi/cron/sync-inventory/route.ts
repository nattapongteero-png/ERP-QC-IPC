/**
 * VMI Inventory Sync Cron API
 *
 * POST /api/purchasing/vmi/cron/sync-inventory - Automated inventory sync for all VMI vendors
 *
 * This endpoint is called by a cron job to sync inventory to VMI Portal for all
 * configured vendors with inventory sync enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql, or, isNotNull } from 'drizzle-orm';
import { getTableRef, executeDbOperation, dbDate } from '@/lib/db/db-helper';
import { VmiPortalService, VmiPortalError, VmiTransactionLogger } from '@/lib/services/vmi-portal.service';
import type { VmiTransactionType, VmiInventoryItem } from '@/types/vmi';

interface VendorSyncResult {
  vendorId: number;
  vendorName: string;
  synced: number;
  failed: number;
  success: boolean;
  error?: string;
}

// POST /api/purchasing/vmi/cron/sync-inventory - Sync inventory for all VMI vendors
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not configured');
      return NextResponse.json(
        { success: false, error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const vmiConfig = getTableRef('vMIVendorConfig');
    const vendors = getTableRef('vendors');
    const items = getTableRef('items');
    const inventoryLots = getTableRef('inventoryLots');
    const vmiTransactions = getTableRef('vMITransactions');

    // Get all vendors with inventory sync enabled
    const enabledVendors = await executeDbOperation(async (db) => {
      return db
        .select({
          vendorId: vmiConfig.vendorId,
          vendorName: vendors.name,
          apiKeyEncrypted: vmiConfig.apiKeyEncrypted,
          baseUrl: vmiConfig.baseUrl,
          vmiVendorId: vmiConfig.vmiVendorId,
          isConnected: vmiConfig.isConnected,
        })
        .from(vmiConfig)
        .innerJoin(vendors, eq(vmiConfig.vendorId, vendors.id))
        .where(
          and(
            eq(vmiConfig.syncInventoryEnabled, true),
            eq(vmiConfig.isConnected, true)
          )
        );
    });

    if (enabledVendors.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          vendorsProcessed: 0,
          successCount: 0,
          failureCount: 0,
          totalItemsSynced: 0,
        },
        results: [],
        message: 'No vendors with inventory sync enabled',
      });
    }

    const results: VendorSyncResult[] = [];
    let totalSynced = 0;
    let successCount = 0;
    let failureCount = 0;

    // Process each vendor
    for (const vendor of enabledVendors) {
      try {
        // Get VMI items for this vendor
        const vmiItems = await executeDbOperation(async (db) => {
          return db
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
        });

        if (vmiItems.length === 0) {
          results.push({
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName || 'Unknown',
            synced: 0,
            failed: 0,
            success: true,
          });
          successCount++;
          continue;
        }

        // Calculate inventory for each item
        const inventoryPayloads: VmiInventoryItem[] = await Promise.all(
          vmiItems.map(async (item: { id: number; code: string; tppCode: string | null; ttmtCode: string | null; primaryUnit: string | null }) => {
            const lotsResult = await executeDbOperation(async (db) => {
              return db
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
            });

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
          vendorId: vendor.vendorId,
          apiKeyEncrypted: vendor.apiKeyEncrypted,
          baseUrl: vendor.baseUrl || undefined,
          vmiVendorId: vendor.vmiVendorId || undefined,
        });
        service.setTransactionLogger(transactionLogger);

        // Sync inventory
        const syncResult = await service.syncInventory(inventoryPayloads);

        // Update last sync time
        await executeDbOperation(async (db) => {
          return db
            .update(vmiConfig)
            .set({
              lastInventorySyncAt: dbDate(),
              updatedAt: dbDate(),
            })
            .where(eq(vmiConfig.vendorId, vendor.vendorId));
        });

        results.push({
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName || 'Unknown',
          synced: syncResult.summary.updated + syncResult.summary.inserted,
          failed: syncResult.summary.failed,
          success: true,
        });

        totalSynced += syncResult.summary.updated + syncResult.summary.inserted;
        successCount++;
      } catch (err) {
        const errorMessage = err instanceof VmiPortalError
          ? err.getUserMessage('en')
          : err instanceof Error
            ? err.message
            : 'Unknown error';

        results.push({
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName || 'Unknown',
          synced: 0,
          failed: 0,
          success: false,
          error: errorMessage,
        });

        failureCount++;
        console.error(`Failed to sync inventory for vendor ${vendor.vendorId}:`, errorMessage);
      }
    }

    return NextResponse.json({
      success: failureCount === 0,
      summary: {
        vendorsProcessed: enabledVendors.length,
        successCount,
        failureCount,
        totalItemsSynced: totalSynced,
      },
      results,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('VMI inventory cron sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
