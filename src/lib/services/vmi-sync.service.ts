/**
 * VMI Sync Service
 *
 * Service for syncing inventory, items, and prices to VMI Portals.
 * This system IS the vendor - pushes data TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { eq, and, isNotNull, isNull, gte, lte, or, inArray } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteItems,
  mysqlItems,
  sqliteVmiPortalConfig,
  mysqlVmiPortalConfig,
  sqliteVmiSyncHistory,
  mysqlVmiSyncHistory,
  sqliteVMIPriceOffers,
  mysqlVMIPriceOffers,
  type VmiSyncHistory,
} from '@/lib/db/schema';
import { decrypt, isValidCiphertext } from '@/lib/crypto/encrypt';
import { getNow } from '../db/date-utils';
import type {
  VmiSyncType,
  VmiSyncTriggerType,
  VmiSyncStatus,
} from '@/types/vmi';

// ============================================
// Error Classes
// ============================================

export class VmiSyncError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly portalId?: number;

  constructor(code: string, message: string, httpStatus: number = 400, portalId?: number) {
    super(message);
    this.name = 'VmiSyncError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.portalId = portalId;
  }
}

// ============================================
// Types
// ============================================

export interface SyncRequest {
  portalId?: number;
  itemIds?: number[];
  async?: boolean;
}

export interface SyncResult {
  syncId: number;
  portalId: number;
  portalName: string;
  syncType: VmiSyncType;
  status: VmiSyncStatus;
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  duration: number;
  errors?: Array<{ itemId: number; itemCode?: string; error: string }>;
}

export interface PortalSyncResult {
  portalId: number;
  portalName: string;
  success: boolean;
  itemsSynced: number;
  error?: string;
}

export interface ScheduledSyncResult {
  portalsProcessed: number;
  results: PortalSyncResult[];
}

interface InventoryItem {
  id: number;
  code: string;
  quantity: number;
  unit: string;
}

interface CatalogItem {
  id: number;
  code: string;
  nameTh: string;
  nameEn: string | null;
  unit: string;
  tppCode: string | null;
  ttmtCode: string | null;
  category: string | null;
}

interface PriceItem {
  id: number;
  code: string;
  unitPrice: number;
  unit: string;
}

interface PortalConfig {
  id: number;
  name: string;
  portalUrl: string;
  vendorId: string;
  apiKeyEncrypted: string;
  syncInventoryEnabled: boolean;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
}

// ============================================
// VMI Sync Service
// ============================================

export class VmiSyncService {
  private readonly BATCH_SIZE = 100;

  // Bug L2: use getter instead of caching isSqlite at construction time
  private get isSqlite(): boolean {
    return isSqlite();
  }

  private log(message: string, data?: unknown) {
    const timestamp = new Date().toISOString();
    if (data !== undefined) {
      console.log(`[VMI Sync] ${timestamp} - ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`[VMI Sync] ${timestamp} - ${message}`);
    }
  }

  private logError(message: string, error: unknown) {
    const timestamp = new Date().toISOString();
    console.error(`[VMI Sync] ${timestamp} - ERROR: ${message}`, error);
  }

  /**
   * Decrypt API key with fallback to plain text for legacy data
   */
  private decryptApiKey(encryptedKey: string): string {
    if (!encryptedKey) {
      throw new Error('API key is empty');
    }

    // Check if it's properly encrypted format (iv:authTag:ciphertext)
    if (isValidCiphertext(encryptedKey)) {
      return decrypt(encryptedKey);
    }

    // Legacy plain text - use as-is
    this.log('[decryptApiKey] Using legacy plain text API key');
    return encryptedKey;
  }

  /**
   * Get the appropriate database connection
   */
  private async getDb() {
    return this.isSqlite ? getSqliteDb() : await getMysqlDb();
  }

  /**
   * Get the appropriate schema tables
   */
  private getTables() {
    return {
      items: this.isSqlite ? sqliteItems : mysqlItems,
      portals: this.isSqlite ? sqliteVmiPortalConfig : mysqlVmiPortalConfig,
      syncHistory: this.isSqlite ? sqliteVmiSyncHistory : mysqlVmiSyncHistory,
      priceOffers: this.isSqlite ? sqliteVMIPriceOffers : mysqlVMIPriceOffers,
    };
  }

  // ============================================
  // Inventory Sync
  // ============================================

  /**
   * Sync inventory levels to VMI Portal(s)
   */
  async syncInventory(
    request: SyncRequest,
    triggerType: VmiSyncTriggerType = 'manual',
    triggeredBy?: number
  ): Promise<SyncResult[]> {
    this.log('=== Starting Inventory Sync ===');
    this.log('Request:', request);
    this.log('Trigger Type:', triggerType);
    this.log('Triggered By:', triggeredBy);

    const portals = await this.getEnabledPortals(request.portalId, 'inventory');
    this.log(`Found ${portals.length} enabled portal(s) for inventory sync`);

    if (portals.length === 0) {
      this.log('No enabled portals found for inventory sync - skipping');
      return [];
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      this.log(`Syncing to portal: ${portal.name} (ID: ${portal.id})`);
      const result = await this.syncInventoryToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      this.log(`Portal ${portal.name} sync result:`, {
        status: result.status,
        itemsTotal: result.itemsTotal,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
      });
      results.push(result);
    }

    this.log('=== Inventory Sync Complete ===', { totalPortals: results.length });
    return results;
  }

  /**
   * Sync inventory to a specific portal
   */
  private async syncInventoryToPortal(
    portal: PortalConfig,
    itemIds: number[] | undefined,
    triggerType: VmiSyncTriggerType,
    triggeredBy?: number
  ): Promise<SyncResult> {
    const startTime = Date.now();
    this.log(`[syncInventoryToPortal] Starting for portal: ${portal.name}`);

    const syncRecord = await this.createSyncRecord(
      portal.id,
      'inventory',
      triggerType,
      triggeredBy
    );
    this.log(`[syncInventoryToPortal] Created sync record ID: ${syncRecord.id}`);

    try {
      // Get VMI-enabled items
      this.log('[syncInventoryToPortal] Getting VMI-enabled items...');
      const items = await this.getVmiEnabledItems(itemIds);
      this.log(`[syncInventoryToPortal] Found ${items.length} VMI-enabled items`);

      if (items.length === 0) {
        this.log('[syncInventoryToPortal] No items to sync, completing with 0 items');
        return await this.completeSyncRecord(syncRecord.id, portal, 'inventory', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Get inventory quantities for items
      this.log('[syncInventoryToPortal] Getting inventory quantities...');
      const inventoryItems = await this.getInventoryQuantities(items.map((i) => i.id));
      this.log(`[syncInventoryToPortal] Got quantities for ${inventoryItems.length} items`);

      // Sync to portal in batches
      this.log('[syncInventoryToPortal] Sending inventory data to portal...');
      const { processed, failed, errors } = await this.sendInventoryToPortal(
        portal,
        inventoryItems
      );
      this.log(`[syncInventoryToPortal] Send complete - processed: ${processed}, failed: ${failed}`);

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === inventoryItems.length ? 'failed' : 'partial';

      if (errors.length > 0) {
        this.logError('[syncInventoryToPortal] Errors during sync:', errors);
      }

      return await this.completeSyncRecord(syncRecord.id, portal, 'inventory', {
        status,
        itemsTotal: inventoryItems.length,
        itemsProcessed: processed,
        itemsFailed: failed,
        duration: Date.now() - startTime,
        errors,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError('[syncInventoryToPortal] Exception occurred:', error);
      return await this.completeSyncRecord(syncRecord.id, portal, 'inventory', {
        status: 'failed',
        itemsTotal: 0,
        itemsProcessed: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        errors: [{ itemId: 0, error: errorMessage }],
      });
    }
  }

  /**
   * Send inventory data to portal API
   */
  private async sendInventoryToPortal(
    portal: PortalConfig,
    items: InventoryItem[]
  ): Promise<{ processed: number; failed: number; errors: Array<{ itemId: number; itemCode?: string; error: string }> }> {
    this.log(`[sendInventoryToPortal] Starting with ${items.length} items to portal: ${portal.name}`);
    this.log(`[sendInventoryToPortal] Portal URL: ${portal.portalUrl}`);
    this.log(`[sendInventoryToPortal] Vendor ID: ${portal.vendorId}`);

    const apiKey = this.decryptApiKey(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    const totalBatches = Math.ceil(items.length / this.BATCH_SIZE);
    this.log(`[sendInventoryToPortal] Will process ${totalBatches} batch(es) of ${this.BATCH_SIZE} items`);

    // Process in batches
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
      const batch = items.slice(i, i + this.BATCH_SIZE);
      this.log(`[sendInventoryToPortal] Processing batch ${batchNumber}/${totalBatches} with ${batch.length} items`);

      // Transform to VMI Portal format (per docs/VMI-VENDOR-API.md)
      const payload = batch.map((item) => ({
        localCode: item.code,
        quantityAvailable: item.quantity,
      }));

      const apiUrl = `${portal.portalUrl}/api/external/vendor/inventory`;
      this.log(`[sendInventoryToPortal] Calling API: POST ${apiUrl}`);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ inventory: payload }),
          signal: AbortSignal.timeout(30000),
        });

        this.log(`[sendInventoryToPortal] Response status: ${response.status}`);

        if (response.ok) {
          processed += batch.length;
          this.log(`[sendInventoryToPortal] Batch ${batchNumber} successful`);
        } else {
          const responseText = await response.text();
          this.logError(`[sendInventoryToPortal] API error response:`, responseText);

          let errorData: Record<string, unknown> = {};
          try {
            errorData = JSON.parse(responseText);
          } catch {
            // Not JSON response
          }
          const errorMessage = (errorData.error as { message?: string })?.message || `HTTP ${response.status}: ${responseText.substring(0, 200)}`;

          // Check if partial success
          if (errorData.results && Array.isArray(errorData.results)) {
            for (const result of errorData.results as Array<{ success: boolean; localCode: string; error?: string }>) {
              if (result.success) {
                processed++;
              } else {
                failed++;
                errors.push({
                  itemId: batch.find((b) => b.code === result.localCode)?.id || 0,
                  itemCode: result.localCode,
                  error: result.error || 'Unknown error',
                });
              }
            }
          } else {
            failed += batch.length;
            batch.forEach((item) => {
              errors.push({
                itemId: item.id,
                itemCode: item.code,
                error: errorMessage,
              });
            });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        this.logError(`[sendInventoryToPortal] Network/fetch error:`, error);
        failed += batch.length;
        batch.forEach((item) => {
          errors.push({
            itemId: item.id,
            itemCode: item.code,
            error: errorMessage,
          });
        });
      }
    }

    this.log(`[sendInventoryToPortal] Complete - processed: ${processed}, failed: ${failed}, errors: ${errors.length}`);
    return { processed, failed, errors };
  }

  // ============================================
  // Item Catalog Sync
  // ============================================

  /**
   * Sync item catalog to VMI Portal(s)
   */
  async syncItems(
    request: SyncRequest,
    triggerType: VmiSyncTriggerType = 'manual',
    triggeredBy?: number
  ): Promise<SyncResult[]> {
    this.log('=== Starting Items Sync ===');
    this.log('Request:', request);
    this.log('Trigger Type:', triggerType);

    const portals = await this.getEnabledPortals(request.portalId, 'items');
    this.log(`Found ${portals.length} enabled portal(s) for items sync`);

    if (portals.length === 0) {
      this.log('No enabled portals found for items sync - skipping');
      return [];
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      this.log(`Syncing items to portal: ${portal.name} (ID: ${portal.id})`);
      const result = await this.syncItemsToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      this.log(`Portal ${portal.name} items sync result:`, {
        status: result.status,
        itemsTotal: result.itemsTotal,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
      });
      results.push(result);
    }

    this.log('=== Items Sync Complete ===', { totalPortals: results.length });
    return results;
  }

  /**
   * Sync item catalog to a specific portal
   */
  private async syncItemsToPortal(
    portal: PortalConfig,
    itemIds: number[] | undefined,
    triggerType: VmiSyncTriggerType,
    triggeredBy?: number
  ): Promise<SyncResult> {
    const startTime = Date.now();
    this.log(`[syncItemsToPortal] Starting for portal: ${portal.name}`);

    const syncRecord = await this.createSyncRecord(
      portal.id,
      'items',
      triggerType,
      triggeredBy
    );
    this.log(`[syncItemsToPortal] Created sync record ID: ${syncRecord.id}`);

    try {
      // Get VMI-enabled items with TPP or TTMT codes
      this.log('[syncItemsToPortal] Getting catalog items...');
      const items = await this.getCatalogItems(itemIds);
      this.log(`[syncItemsToPortal] Found ${items.length} catalog items`);

      if (items.length === 0) {
        this.log('[syncItemsToPortal] No items to sync, completing with 0 items');
        return await this.completeSyncRecord(syncRecord.id, portal, 'items', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Sync to portal
      this.log('[syncItemsToPortal] Sending items data to portal...');
      const { processed, failed, errors } = await this.sendItemsToPortal(portal, items);
      this.log(`[syncItemsToPortal] Send complete - processed: ${processed}, failed: ${failed}`);

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === items.length ? 'failed' : 'partial';

      if (errors.length > 0) {
        this.logError('[syncItemsToPortal] Errors during sync:', errors);
      }

      return await this.completeSyncRecord(syncRecord.id, portal, 'items', {
        status,
        itemsTotal: items.length,
        itemsProcessed: processed,
        itemsFailed: failed,
        duration: Date.now() - startTime,
        errors,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError('[syncItemsToPortal] Exception occurred:', error);
      return await this.completeSyncRecord(syncRecord.id, portal, 'items', {
        status: 'failed',
        itemsTotal: 0,
        itemsProcessed: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        errors: [{ itemId: 0, error: errorMessage }],
      });
    }
  }

  /**
   * Send item catalog data to portal API
   */
  private async sendItemsToPortal(
    portal: PortalConfig,
    items: CatalogItem[]
  ): Promise<{ processed: number; failed: number; errors: Array<{ itemId: number; itemCode?: string; error: string }> }> {
    this.log(`[sendItemsToPortal] Starting with ${items.length} items to portal: ${portal.name}`);

    const apiKey = this.decryptApiKey(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    const totalBatches = Math.ceil(items.length / this.BATCH_SIZE);
    this.log(`[sendItemsToPortal] Will process ${totalBatches} batch(es)`);

    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
      const batch = items.slice(i, i + this.BATCH_SIZE);
      this.log(`[sendItemsToPortal] Processing batch ${batchNumber}/${totalBatches}`);

      // Transform to VMI Portal format (per docs/VMI-VENDOR-API.md).
      // The Portal's Zod schema treats tppCode/ttmtCode/category as OPTIONAL
      // strings — it accepts the key being absent, but rejects an explicit
      // `null` ("expected string, received null"). DB columns are nullable, so
      // we must OMIT a field when it has no value rather than send null/"".
      // One null in a batch fails the whole batch, which is why every item in
      // the request was reported as failed even when only one had a null code.
      const payload = batch.map((item) => {
        const entry: Record<string, unknown> = {
          localCode: item.code,
          name: item.nameTh,
          unit: item.unit,
          packSize: 1, // Default pack size
          packUnit: item.unit,
          isActive: true,
        };
        if (item.tppCode) entry.tppCode = item.tppCode;
        if (item.ttmtCode) entry.ttmtCode = item.ttmtCode;
        if (item.category) entry.category = item.category;
        return entry;
      });

      const apiUrl = `${portal.portalUrl}/api/external/vendor/items`;
      this.log(`[sendItemsToPortal] Calling API: POST ${apiUrl}`);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ items: payload }),
          signal: AbortSignal.timeout(30000),
        });

        this.log(`[sendItemsToPortal] Response status: ${response.status}`);

        if (response.ok) {
          processed += batch.length;
        } else {
          failed += batch.length;
          const responseText = await response.text();
          this.logError(`[sendItemsToPortal] API error:`, responseText);
          let errorData: Record<string, unknown> = {};
          try {
            errorData = JSON.parse(responseText);
          } catch {
            // Not JSON response
          }
          // Surface the Portal's real validation message instead of a bare
          // "HTTP 400" so the operator can see WHY the catalog push was rejected.
          // Per docs/VMI-VENDOR-API.md the Portal returns a validation error as
          //   { success:false, code, message, errors:[{field,message}] }
          // but some endpoints use { error:{message,details} } / { issues:[] }.
          // Accept all shapes; fall back to the raw body when none are present.
          const errObj = errorData.error as { message?: string; details?: unknown } | undefined;
          const fieldErrors = (errorData.errors || errObj?.details || errorData.issues) as
            | Array<{ field?: string; message?: string }>
            | undefined;
          const detailStr =
            Array.isArray(fieldErrors) && fieldErrors.length > 0
              ? ' — ' +
                fieldErrors
                  .map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
                  .join('; ')
                  .slice(0, 400)
              : '';
          const baseMsg =
            (errorData.message as string | undefined) ||
            errObj?.message ||
            (responseText ? responseText.slice(0, 300) : `HTTP ${response.status}`);
          const fullError = `HTTP ${response.status}: ${baseMsg}${detailStr}`;
          batch.forEach((item) => {
            errors.push({
              itemId: item.id,
              itemCode: item.code,
              error: fullError,
            });
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        this.logError(`[sendItemsToPortal] Network/fetch error:`, error);
        failed += batch.length;
        batch.forEach((item) => {
          errors.push({
            itemId: item.id,
            itemCode: item.code,
            error: errorMessage,
          });
        });
      }
    }

    this.log(`[sendItemsToPortal] Complete - processed: ${processed}, failed: ${failed}`);
    return { processed, failed, errors };
  }

  // ============================================
  // Price Sync
  // ============================================

  /**
   * Sync prices to VMI Portal(s)
   */
  async syncPrices(
    request: SyncRequest,
    triggerType: VmiSyncTriggerType = 'manual',
    triggeredBy?: number
  ): Promise<SyncResult[]> {
    this.log('=== Starting Prices Sync ===');
    this.log('Request:', request);
    this.log('Trigger Type:', triggerType);

    const portals = await this.getEnabledPortals(request.portalId, 'prices');
    this.log(`Found ${portals.length} enabled portal(s) for prices sync`);

    if (portals.length === 0) {
      this.log('No enabled portals found for prices sync - skipping');
      return [];
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      this.log(`Syncing prices to portal: ${portal.name} (ID: ${portal.id})`);
      const result = await this.syncPricesToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      this.log(`Portal ${portal.name} prices sync result:`, {
        status: result.status,
        itemsTotal: result.itemsTotal,
        itemsProcessed: result.itemsProcessed,
        itemsFailed: result.itemsFailed,
      });
      results.push(result);
    }

    this.log('=== Prices Sync Complete ===', { totalPortals: results.length });
    return results;
  }

  /**
   * Sync prices to a specific portal
   */
  private async syncPricesToPortal(
    portal: PortalConfig,
    itemIds: number[] | undefined,
    triggerType: VmiSyncTriggerType,
    triggeredBy?: number
  ): Promise<SyncResult> {
    const startTime = Date.now();
    this.log(`[syncPricesToPortal] Starting for portal: ${portal.name}`);

    const syncRecord = await this.createSyncRecord(
      portal.id,
      'prices',
      triggerType,
      triggeredBy
    );
    this.log(`[syncPricesToPortal] Created sync record ID: ${syncRecord.id}`);

    try {
      // Get VMI-enabled items with prices
      this.log('[syncPricesToPortal] Getting price items...');
      const items = await this.getPriceItems(itemIds);
      this.log(`[syncPricesToPortal] Found ${items.length} price items`);

      if (items.length === 0) {
        this.log('[syncPricesToPortal] No items to sync, completing with 0 items');
        return await this.completeSyncRecord(syncRecord.id, portal, 'prices', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Sync to portal
      this.log('[syncPricesToPortal] Sending prices data to portal...');
      const { processed, failed, errors } = await this.sendPricesToPortal(portal, items);
      this.log(`[syncPricesToPortal] Send complete - processed: ${processed}, failed: ${failed}`);

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === items.length ? 'failed' : 'partial';

      if (errors.length > 0) {
        this.logError('[syncPricesToPortal] Errors during sync:', errors);
      }

      return await this.completeSyncRecord(syncRecord.id, portal, 'prices', {
        status,
        itemsTotal: items.length,
        itemsProcessed: processed,
        itemsFailed: failed,
        duration: Date.now() - startTime,
        errors,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logError('[syncPricesToPortal] Exception occurred:', error);
      return await this.completeSyncRecord(syncRecord.id, portal, 'prices', {
        status: 'failed',
        itemsTotal: 0,
        itemsProcessed: 0,
        itemsFailed: 0,
        duration: Date.now() - startTime,
        errors: [{ itemId: 0, error: errorMessage }],
      });
    }
  }

  /**
   * Send prices to portal API
   */
  private async sendPricesToPortal(
    portal: PortalConfig,
    items: PriceItem[]
  ): Promise<{ processed: number; failed: number; errors: Array<{ itemId: number; itemCode?: string; error: string }> }> {
    this.log(`[sendPricesToPortal] Starting with ${items.length} items to portal: ${portal.name}`);

    const apiKey = this.decryptApiKey(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    const totalBatches = Math.ceil(items.length / this.BATCH_SIZE);
    this.log(`[sendPricesToPortal] Will process ${totalBatches} batch(es)`);

    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
      const batch = items.slice(i, i + this.BATCH_SIZE);
      this.log(`[sendPricesToPortal] Processing batch ${batchNumber}/${totalBatches}`);

      // Filter out items with no valid price (API requires unitPrice > 0)
      const validPriceItems = batch.filter((item) => item.unitPrice > 0);
      const skippedCount = batch.length - validPriceItems.length;

      if (skippedCount > 0) {
        this.log(`[sendPricesToPortal] Skipping ${skippedCount} items with no valid price (unitPrice must be > 0)`);
        // Mark skipped items as failed
        failed += skippedCount;
        batch.filter((item) => item.unitPrice <= 0).forEach((item) => {
          errors.push({
            itemId: item.id,
            itemCode: item.code,
            error: 'No valid price configured (unitPrice must be > 0)',
          });
        });
      }

      if (validPriceItems.length === 0) {
        this.log(`[sendPricesToPortal] No items with valid prices in this batch, skipping`);
        continue;
      }

      // Transform to VMI Portal format (per docs/VMI-VENDOR-API.md)
      const payload = validPriceItems.map((item) => ({
        localCode: item.code,
        unitPrice: Number(item.unitPrice),
        effectiveDate: new Date().toISOString(),
        isActive: true,
      }));

      const apiUrl = `${portal.portalUrl}/api/external/vendor/prices`;
      this.log(`[sendPricesToPortal] Calling API: POST ${apiUrl}`);

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ offers: payload }),
          signal: AbortSignal.timeout(30000),
        });

        this.log(`[sendPricesToPortal] Response status: ${response.status}`);

        if (response.ok) {
          processed += validPriceItems.length;
        } else {
          failed += validPriceItems.length;
          const responseText = await response.text();
          this.logError(`[sendPricesToPortal] API error:`, responseText);
          let errorData: Record<string, unknown> = {};
          try {
            errorData = JSON.parse(responseText);
          } catch {
            // Not JSON response
          }
          validPriceItems.forEach((item) => {
            errors.push({
              itemId: item.id,
              itemCode: item.code,
              error: (errorData.error as { message?: string })?.message || `HTTP ${response.status}`,
            });
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        this.logError(`[sendPricesToPortal] Network/fetch error:`, error);
        failed += validPriceItems.length;
        validPriceItems.forEach((item) => {
          errors.push({
            itemId: item.id,
            itemCode: item.code,
            error: errorMessage,
          });
        });
      }
    }

    this.log(`[sendPricesToPortal] Complete - processed: ${processed}, failed: ${failed}, errors: ${errors.length}`);
    return { processed, failed, errors };
  }

  // ============================================
  // Sync History
  // ============================================

  /**
   * Get sync history
   */
  async getSyncHistory(options: {
    portalId?: number;
    syncType?: VmiSyncType;
    status?: VmiSyncStatus;
    page?: number;
    limit?: number;
  }): Promise<{ items: VmiSyncHistory[]; total: number; page: number; limit: number; totalPages: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { syncHistory } = this.getTables();
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions: ReturnType<typeof eq>[] = [];
    if (options.portalId) {
      conditions.push(eq(syncHistory.portalId, options.portalId));
    }
    if (options.syncType) {
      conditions.push(eq(syncHistory.syncType, options.syncType));
    }
    if (options.status) {
      conditions.push(eq(syncHistory.status, options.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get items
    const items = await db
      .select()
      .from(syncHistory)
      .where(whereClause)
      .orderBy(syncHistory.startedAt)
      .limit(limit)
      .offset(offset);

    // Get total count (simplified - could be optimized)
    const allItems = await db.select().from(syncHistory).where(whereClause);
    const total = allItems.length;

    return {
      items: items as VmiSyncHistory[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get sync history detail by ID
   */
  async getSyncHistoryById(syncId: number): Promise<VmiSyncHistory | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { syncHistory } = this.getTables();

    const [record] = await db.select().from(syncHistory).where(eq(syncHistory.id, syncId));
    return record as VmiSyncHistory | null;
  }

  // ============================================
  // Scheduled Sync
  // ============================================

  /**
   * Run scheduled inventory sync for all eligible portals
   */
  async runScheduledInventorySync(): Promise<ScheduledSyncResult> {
    const portals = await this.getEnabledPortals(undefined, 'inventory');
    const results: PortalSyncResult[] = [];

    for (const portal of portals) {
      try {
        const syncResults = await this.syncInventory(
          { portalId: portal.id },
          'scheduled'
        );
        const result = syncResults[0];

        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: result.status !== 'failed',
          itemsSynced: result.itemsProcessed,
          error: result.status === 'failed' ? result.errors?.[0]?.error : undefined,
        });
      } catch (error) {
        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: false,
          itemsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      portalsProcessed: portals.length,
      results,
    };
  }

  /**
   * Run scheduled items sync for all eligible portals
   */
  async runScheduledItemsSync(): Promise<ScheduledSyncResult> {
    const portals = await this.getEnabledPortals(undefined, 'items');
    const results: PortalSyncResult[] = [];

    for (const portal of portals) {
      try {
        const syncResults = await this.syncItems(
          { portalId: portal.id },
          'scheduled'
        );
        const result = syncResults[0];

        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: result.status !== 'failed',
          itemsSynced: result.itemsProcessed,
          error: result.status === 'failed' ? result.errors?.[0]?.error : undefined,
        });
      } catch (error) {
        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: false,
          itemsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      portalsProcessed: portals.length,
      results,
    };
  }

  /**
   * Run scheduled prices sync for all eligible portals
   */
  async runScheduledPricesSync(): Promise<ScheduledSyncResult> {
    const portals = await this.getEnabledPortals(undefined, 'prices');
    const results: PortalSyncResult[] = [];

    for (const portal of portals) {
      try {
        const syncResults = await this.syncPrices(
          { portalId: portal.id },
          'scheduled'
        );
        const result = syncResults[0];

        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: result.status !== 'failed',
          itemsSynced: result.itemsProcessed,
          error: result.status === 'failed' ? result.errors?.[0]?.error : undefined,
        });
      } catch (error) {
        results.push({
          portalId: portal.id,
          portalName: portal.name,
          success: false,
          itemsSynced: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      portalsProcessed: portals.length,
      results,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get enabled portals for a specific sync type
   */
  private async getEnabledPortals(
    portalId: number | undefined,
    syncType: 'inventory' | 'items' | 'prices'
  ): Promise<PortalConfig[]> {
    this.log(`[getEnabledPortals] Looking for ${syncType} sync portals, portalId filter: ${portalId || 'none'}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { portals } = this.getTables();

    const syncEnabledField = {
      inventory: portals.syncInventoryEnabled,
      items: portals.syncItemsEnabled,
      prices: portals.syncPricesEnabled,
    }[syncType];

    const conditions = [eq(portals.isEnabled, true), eq(syncEnabledField, true)];

    if (portalId) {
      conditions.push(eq(portals.id, portalId));
    }

    const records = await db
      .select({
        id: portals.id,
        name: portals.name,
        portalUrl: portals.portalUrl,
        vendorId: portals.vendorId,
        apiKeyEncrypted: portals.apiKeyEncrypted,
        syncInventoryEnabled: portals.syncInventoryEnabled,
        syncItemsEnabled: portals.syncItemsEnabled,
        syncPricesEnabled: portals.syncPricesEnabled,
      })
      .from(portals)
      .where(and(...conditions));

    this.log(`[getEnabledPortals] Found ${records.length} portal(s)`, records.map((r: PortalConfig) => ({
      id: r.id,
      name: r.name,
      portalUrl: r.portalUrl,
      vendorId: r.vendorId,
    })));

    return records;
  }

  /**
   * Get VMI-enabled items
   */
  private async getVmiEnabledItems(
    itemIds: number[] | undefined
  ): Promise<Array<{ id: number; code: string }>> {
    this.log(`[getVmiEnabledItems] Getting items with vmiSyncEnabled=true, itemIds filter: ${itemIds?.length || 'none'}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items } = this.getTables();

    const conditions = [eq(items.vmiSyncEnabled, true)];

    if (itemIds && itemIds.length > 0) {
      conditions.push(inArray(items.id, itemIds));
    }

    const records = await db
      .select({
        id: items.id,
        code: items.code,
      })
      .from(items)
      .where(and(...conditions));

    this.log(`[getVmiEnabledItems] Found ${records.length} VMI-enabled items`);
    if (records.length > 0 && records.length <= 10) {
      this.log('[getVmiEnabledItems] Items:', records);
    }

    return records;
  }

  /**
   * Get inventory quantities for items
   */
  private async getInventoryQuantities(itemIds: number[]): Promise<InventoryItem[]> {
    this.log(`[getInventoryQuantities] Getting quantities for ${itemIds.length} items`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items } = this.getTables();

    const records = await db
      .select({
        id: items.id,
        code: items.code,
        quantity: items.onHand,
        unit: items.primaryUnit,
      })
      .from(items)
      .where(inArray(items.id, itemIds));

    const result = records.map((r: { id: number; code: string; quantity: number | string | null; unit: string }) => ({
      id: r.id,
      code: r.code,
      quantity: Number(r.quantity) || 0, // Ensure number type (MySQL DECIMAL returns string)
      unit: r.unit,
    }));

    this.log(`[getInventoryQuantities] Got quantities for ${result.length} items`);
    return result;
  }

  /**
   * Get catalog items with TPP/TTMT codes
   */
  private async getCatalogItems(itemIds: number[] | undefined): Promise<CatalogItem[]> {
    this.log(`[getCatalogItems] Getting catalog items with TPP/TTMT codes, itemIds filter: ${itemIds?.length || 'none'}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items } = this.getTables();

    const conditions = [
      eq(items.vmiSyncEnabled, true),
      or(isNotNull(items.tppCode), isNotNull(items.ttmtCode)),
    ];

    if (itemIds && itemIds.length > 0) {
      conditions.push(inArray(items.id, itemIds));
    }

    const records = await db
      .select({
        id: items.id,
        code: items.code,
        nameTh: items.nameTh,
        nameEn: items.nameEn,
        unit: items.primaryUnit,
        tppCode: items.tppCode,
        ttmtCode: items.ttmtCode,
        category: items.category,
      })
      .from(items)
      .where(and(...conditions));

    this.log(`[getCatalogItems] Found ${records.length} catalog items with TPP/TTMT codes`);
    return records;
  }

  /**
   * Get items with prices from vmi_price_offers table
   * Only returns items that have active price offers with valid effective dates
   */
  private async getPriceItems(itemIds: number[] | undefined): Promise<PriceItem[]> {
    this.log(`[getPriceItems] Getting price items from vmi_price_offers, itemIds filter: ${itemIds?.length || 'none'}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items, priceOffers } = this.getTables();

    // Get current date for filtering active offers
    const now = getNow();

    // Build conditions for items
    const itemConditions = [
      eq(items.vmiSyncEnabled, true),
    ];

    if (itemIds && itemIds.length > 0) {
      itemConditions.push(inArray(items.id, itemIds));
    }

    // Join items with vmi_price_offers
    // Filter for active offers where effectiveDate <= now and (expiryDate is null OR expiryDate >= now)
    const records = await db
      .select({
        id: items.id,
        code: items.code,
        unit: items.primaryUnit,
        unitPrice: priceOffers.unitPrice,
      })
      .from(items)
      .innerJoin(priceOffers, eq(items.id, priceOffers.itemId))
      .where(
        and(
          ...itemConditions,
          eq(priceOffers.isActive, true),
          lte(priceOffers.effectiveDate, now as any),
          or(
            isNull(priceOffers.expiryDate),
            gte(priceOffers.expiryDate, now as any)
          )
        )
      );

    this.log(`[getPriceItems] Found ${records.length} items with active price offers`);

    // MySQL DECIMAL columns return strings, so convert to numbers
    return records.map((r: { id: number; code: string; unit: string; unitPrice: string | number }) => ({
      id: r.id,
      code: r.code,
      unitPrice: Number(r.unitPrice) || 0,
      unit: r.unit,
    }));
  }

  /**
   * Create sync history record
   */
  private async createSyncRecord(
    portalId: number,
    syncType: VmiSyncType,
    triggerType: VmiSyncTriggerType,
    triggeredBy?: number
  ): Promise<{ id: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { syncHistory } = this.getTables();

    const now = getNow();

    const [result] = await db
      .insert(syncHistory)
      .values({
        portalId,
        syncType,
        triggerType,
        status: 'running',
        itemsTotal: 0,
        itemsProcessed: 0,
        itemsFailed: 0,
        triggeredBy,
        startedAt: now,
      } as Record<string, unknown>)
      .$returningId();

    return { id: result.id };
  }

  /**
   * Complete sync history record
   */
  private async completeSyncRecord(
    syncId: number,
    portal: PortalConfig,
    syncType: VmiSyncType,
    data: {
      status: VmiSyncStatus;
      itemsTotal: number;
      itemsProcessed: number;
      itemsFailed: number;
      duration: number;
      errors?: Array<{ itemId: number; itemCode?: string; error: string }>;
    }
  ): Promise<SyncResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { syncHistory } = this.getTables();

    const now = getNow();

    await db
      .update(syncHistory)
      .set({
        status: data.status,
        itemsTotal: data.itemsTotal,
        itemsProcessed: data.itemsProcessed,
        itemsFailed: data.itemsFailed,
        errorDetails: data.errors ? JSON.stringify(data.errors) : null,
        completedAt: now,
      } as Record<string, unknown>)
      .where(eq(syncHistory.id, syncId));

    return {
      syncId,
      portalId: portal.id,
      portalName: portal.name,
      syncType,
      status: data.status,
      itemsTotal: data.itemsTotal,
      itemsProcessed: data.itemsProcessed,
      itemsFailed: data.itemsFailed,
      duration: data.duration,
      errors: data.errors,
    };
  }

  /**
   * Record order poll result to sync history
   */
  async recordOrderPollHistory(data: {
    ordersReceived: number;
    errors?: Array<{ portalId: number; error: string }>;
    errorPortalIds: Set<number>;
  }): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { portals, syncHistory } = this.getTables();

    // Get all enabled portals with order polling
    const records = await db
      .select({ id: portals.id })
      .from(portals)
      .where(and(eq(portals.isEnabled, true), eq(portals.orderPollingEnabled, true)));

    const now = getNow();

    for (const portal of records) {
      const portalError = data.errors?.find((e: { portalId: number }) => e.portalId === portal.id);
      const status = portalError ? 'failed' : 'completed';

      await db
        .insert(syncHistory)
        .values({
          portalId: portal.id,
          syncType: 'orders',
          triggerType: 'scheduled',
          status,
          itemsTotal: portalError ? 0 : data.ordersReceived,
          itemsProcessed: portalError ? 0 : data.ordersReceived,
          itemsFailed: portalError ? 1 : 0,
          errorDetails: portalError ? JSON.stringify([{ error: portalError.error }]) : '[]',
          startedAt: now,
          completedAt: now,
        } as Record<string, unknown>);
    }
  }
}

// Export singleton instance
export const vmiSyncService = new VmiSyncService();
