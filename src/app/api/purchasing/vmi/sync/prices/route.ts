/**
 * VMI Prices Sync API Routes
 *
 * GET /api/purchasing/vmi/sync/prices - Get price offers for a vendor
 * POST /api/purchasing/vmi/sync/prices - Sync prices to VMI Portal
 */

import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import {
  sqliteVMIVendorConfig,
  sqliteVMIPriceOffers,
  sqliteItems,
  sqliteVMITransactions,
  mysqlVMIVendorConfig,
  mysqlVMIPriceOffers,
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
import type { VmiTransactionType, VmiPriceOfferPayload } from '@/types/vmi';

// GET /api/purchasing/vmi/sync/prices - Get price offers for a vendor
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const vendorIdStr = searchParams.get('vendorId');
      const activeOnly = searchParams.get('activeOnly') !== 'false';

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
      const priceOffers = isSqlite ? sqliteVMIPriceOffers : mysqlVMIPriceOffers;
      const items = isSqlite ? sqliteItems : mysqlItems;

      // Verify vendor has VMI configuration
      const configResult = await (db as any)
        .select()
        .from(vmiConfig)
        .where(eq(vmiConfig.vendorId, vendorId));

      if (configResult.length === 0) {
        return errorResponse('VMI configuration not found for vendor');
      }

      const config = configResult[0];
      const today = new Date().toISOString().split('T')[0];

      // Get price offers with item info
      const offersQuery = (db as any)
        .select({
          id: priceOffers.id,
          vendorId: priceOffers.vendorId,
          itemId: priceOffers.itemId,
          itemCode: items.code,
          itemName: items.nameTh,
          itemNameEn: items.nameEn,
          tppCode: items.tppCode,
          ttmtCode: items.ttmtCode,
          unitPrice: priceOffers.unitPrice,
          packPrice: priceOffers.packPrice,
          moq: priceOffers.moq,
          leadTimeDays: priceOffers.leadTimeDays,
          effectiveDate: priceOffers.effectiveDate,
          expiryDate: priceOffers.expiryDate,
          isActive: priceOffers.isActive,
          lastSyncedAt: priceOffers.lastSyncedAt,
          syncStatus: priceOffers.syncStatus,
          createdAt: priceOffers.createdAt,
          updatedAt: priceOffers.updatedAt,
        })
        .from(priceOffers)
        .leftJoin(items, eq(priceOffers.itemId, items.id))
        .where(eq(priceOffers.vendorId, vendorId));

      const offersResult = await offersQuery;

      // Filter and enrich offers
      type OfferResultType = typeof offersResult[number];
      const enrichedOffers = offersResult.map((offer: OfferResultType) => {
        const validFrom = offer.effectiveDate?.toString().split('T')[0] || '';
        const validTo = offer.expiryDate?.toString().split('T')[0] || '';
        const isActive = offer.isActive && validFrom <= today && validTo >= today;
        const lastSyncAt = config.lastPricesSyncAt ? new Date(config.lastPricesSyncAt) : null;
        const updatedAt = offer.updatedAt ? new Date(offer.updatedAt as string) : null;
        const needsSync = !lastSyncAt || (updatedAt && updatedAt > lastSyncAt);

        return {
          ...offer,
          validFrom,
          validTo,
          isActive,
          needsSync,
          hasVmiCode: !!(offer.tppCode || offer.ttmtCode),
        };
      });

      // Filter by active status if requested
      type EnrichedOfferType = typeof enrichedOffers[number];
      const filteredOffers = activeOnly
        ? enrichedOffers.filter((o: EnrichedOfferType) => o.isActive)
        : enrichedOffers;

      const pendingCount = filteredOffers.filter((o: EnrichedOfferType) => o.needsSync && o.hasVmiCode).length;

      return successResponse({
        vendorId,
        offers: filteredOffers,
        total: filteredOffers.length,
        pendingCount,
        lastSyncAt: config.lastPricesSyncAt,
        syncEnabled: config.syncPricesEnabled,
      });
    } catch (error) {
      return serverErrorResponse(error);
    }
  }, ['purchasing:read']);
}

// POST /api/purchasing/vmi/sync/prices - Sync prices to VMI Portal
export async function POST(request: NextRequest) {
  return withAuth(request, async (session) => {
    try {
      const body = await request.json();
      const { vendorId, offerIds } = body;

      if (!vendorId) {
        return errorResponse('Vendor ID is required');
      }

      const db = await getDb();
      const isSqlite = process.env.DB_TYPE === 'sqlite';
      const vmiConfig = isSqlite ? sqliteVMIVendorConfig : mysqlVMIVendorConfig;
      const priceOffers = isSqlite ? sqliteVMIPriceOffers : mysqlVMIPriceOffers;
      const items = isSqlite ? sqliteItems : mysqlItems;
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

      // Get offers to sync with item info
      const today = new Date().toISOString().split('T')[0];
      let offersQuery = (db as any)
        .select({
          id: priceOffers.id,
          itemId: priceOffers.itemId,
          itemCode: items.code,
          tppCode: items.tppCode,
          ttmtCode: items.ttmtCode,
          unitPrice: priceOffers.unitPrice,
          packPrice: priceOffers.packPrice,
          moq: priceOffers.moq,
          leadTimeDays: priceOffers.leadTimeDays,
          effectiveDate: priceOffers.effectiveDate,
          expiryDate: priceOffers.expiryDate,
          isActive: priceOffers.isActive,
        })
        .from(priceOffers)
        .leftJoin(items, eq(priceOffers.itemId, items.id))
        .where(eq(priceOffers.vendorId, vendorId));

      let offersToSync = await offersQuery;
      type OfferToSyncType = typeof offersToSync[number];

      // Filter by requested IDs if provided
      if (offerIds && offerIds.length > 0) {
        offersToSync = offersToSync.filter((offer: OfferToSyncType) => offerIds.includes(offer.id));
      }

      // Filter to only active offers with VMI codes
      offersToSync = offersToSync.filter((offer: OfferToSyncType) => {
        const validFrom = offer.effectiveDate?.toString().split('T')[0] || '';
        const validTo = offer.expiryDate?.toString().split('T')[0] || '';
        const isActive = offer.isActive && validFrom <= today && validTo >= today;
        const hasCode = offer.tppCode || offer.ttmtCode;
        return isActive && hasCode;
      });

      if (offersToSync.length === 0) {
        return successResponse(
          { vendorId, synced: 0, failed: 0, errors: [] },
          'No active price offers to sync'
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

      // Prepare offers for VMI Portal
      const vmiOffers: VmiPriceOfferPayload[] = offersToSync.map((offer: OfferToSyncType) => ({
        localCode: offer.itemCode || '',  // Required by VMI Portal API
        unitPrice: Number(offer.unitPrice),
        packPrice: offer.packPrice ? Number(offer.packPrice) : undefined,
        moq: offer.moq || undefined,
        leadTimeDays: offer.leadTimeDays || undefined,
        effectiveDate: offer.effectiveDate?.toString().split('T')[0] || today,  // Required by VMI Portal API
        expiryDate: offer.expiryDate?.toString().split('T')[0] || undefined,
      }));

      try {
        // Sync prices to VMI Portal
        const result = await service.syncPrices(vmiOffers);

        const now = new Date();

        // Update last sync time
        await (db as any)
          .update(vmiConfig)
          .set({
            lastPricesSyncAt: isSqlite ? now.toISOString() : now,
            updatedAt: isSqlite ? now.toISOString() : now,
          })
          .where(eq(vmiConfig.vendorId, vendorId));

        // Update lastSyncedAt for synced offers
        for (const offer of offersToSync) {
          await (db as any)
            .update(priceOffers)
            .set({
              lastSyncedAt: isSqlite ? now.toISOString() : now,
              updatedAt: isSqlite ? now.toISOString() : now,
            })
            .where(eq(priceOffers.id, offer.id));
        }

        const syncedCount = result.summary.updated + result.summary.inserted;
        const failedCount = result.summary.failed;

        // Create audit log
        await createAuditLog({
          userId: session.userId,
          action: 'SYNC',
          tableName: 'vmi_price_offers',
          recordId: vendorId,
          newValue: {
            type: 'vmi_prices_sync',
            synced: syncedCount,
            failed: failedCount,
            offerCount: offersToSync.length,
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
          `Successfully synced ${syncedCount} price offers to VMI Portal`
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
