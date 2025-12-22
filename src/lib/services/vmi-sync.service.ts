/**
 * VMI Sync Service
 *
 * Service for syncing inventory, items, and prices to VMI Portals.
 * This system IS the vendor - pushes data TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { eq, and, isNotNull, gte, or, inArray } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteItems,
  mysqlItems,
  sqliteVmiPortalConfig,
  mysqlVmiPortalConfig,
  sqliteVmiSyncHistory,
  mysqlVmiSyncHistory,
  type VmiSyncHistory,
} from '@/lib/db/schema';
import { decrypt } from '@/lib/crypto/encrypt';
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
  private readonly isSqlite: boolean;
  private readonly BATCH_SIZE = 100;

  constructor() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    this.isSqlite = isSqlite();
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
    const portals = await this.getEnabledPortals(request.portalId, 'inventory');

    if (portals.length === 0) {
      throw new VmiSyncError('NO_PORTALS', 'No enabled portals found for inventory sync', 404);
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      const result = await this.syncInventoryToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      results.push(result);
    }

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
    const syncRecord = await this.createSyncRecord(
      portal.id,
      'inventory',
      triggerType,
      triggeredBy
    );

    try {
      // Get VMI-enabled items
      const items = await this.getVmiEnabledItems(itemIds);

      if (items.length === 0) {
        return await this.completeSyncRecord(syncRecord.id, portal, 'inventory', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Get inventory quantities for items
      const inventoryItems = await this.getInventoryQuantities(items.map((i) => i.id));

      // Sync to portal in batches
      const { processed, failed, errors } = await this.sendInventoryToPortal(
        portal,
        inventoryItems
      );

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === inventoryItems.length ? 'failed' : 'partial';

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
    const apiKey = decrypt(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batch = items.slice(i, i + this.BATCH_SIZE);

      // Transform to VMI Portal format
      const payload = batch.map((item) => ({
        localCode: item.code,
        quantityAvailable: item.quantity,
        unit: item.unit,
      }));

      try {
        const response = await fetch(`${portal.portalUrl}/api/vendor/inventory`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-Vendor-Id': portal.vendorId,
          },
          body: JSON.stringify({ items: payload }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          processed += batch.length;
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

          // Check if partial success
          if (errorData.results) {
            for (const result of errorData.results) {
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
    const portals = await this.getEnabledPortals(request.portalId, 'items');

    if (portals.length === 0) {
      throw new VmiSyncError('NO_PORTALS', 'No enabled portals found for items sync', 404);
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      const result = await this.syncItemsToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      results.push(result);
    }

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
    const syncRecord = await this.createSyncRecord(
      portal.id,
      'items',
      triggerType,
      triggeredBy
    );

    try {
      // Get VMI-enabled items with TPP or TTMT codes
      const items = await this.getCatalogItems(itemIds);

      if (items.length === 0) {
        return await this.completeSyncRecord(syncRecord.id, portal, 'items', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Sync to portal
      const { processed, failed, errors } = await this.sendItemsToPortal(portal, items);

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === items.length ? 'failed' : 'partial';

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
    const apiKey = decrypt(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batch = items.slice(i, i + this.BATCH_SIZE);

      const payload = batch.map((item) => ({
        localCode: item.code,
        name: item.nameTh,
        nameEn: item.nameEn,
        unit: item.unit,
        tppCode: item.tppCode,
        ttmtCode: item.ttmtCode,
        category: item.category,
      }));

      try {
        const response = await fetch(`${portal.portalUrl}/api/vendor/items`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-Vendor-Id': portal.vendorId,
          },
          body: JSON.stringify({ items: payload }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          processed += batch.length;
        } else {
          failed += batch.length;
          const errorData = await response.json().catch(() => ({}));
          batch.forEach((item) => {
            errors.push({
              itemId: item.id,
              itemCode: item.code,
              error: errorData.error?.message || `HTTP ${response.status}`,
            });
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
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
    const portals = await this.getEnabledPortals(request.portalId, 'prices');

    if (portals.length === 0) {
      throw new VmiSyncError('NO_PORTALS', 'No enabled portals found for prices sync', 404);
    }

    const results: SyncResult[] = [];

    for (const portal of portals) {
      const result = await this.syncPricesToPortal(
        portal,
        request.itemIds,
        triggerType,
        triggeredBy
      );
      results.push(result);
    }

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
    const syncRecord = await this.createSyncRecord(
      portal.id,
      'prices',
      triggerType,
      triggeredBy
    );

    try {
      // Get VMI-enabled items with prices
      const items = await this.getPriceItems(itemIds);

      if (items.length === 0) {
        return await this.completeSyncRecord(syncRecord.id, portal, 'prices', {
          status: 'completed',
          itemsTotal: 0,
          itemsProcessed: 0,
          itemsFailed: 0,
          duration: Date.now() - startTime,
        });
      }

      // Sync to portal
      const { processed, failed, errors } = await this.sendPricesToPortal(portal, items);

      const status: VmiSyncStatus =
        failed === 0 ? 'completed' : failed === items.length ? 'failed' : 'partial';

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
    const apiKey = decrypt(portal.apiKeyEncrypted);
    const errors: Array<{ itemId: number; itemCode?: string; error: string }> = [];
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i += this.BATCH_SIZE) {
      const batch = items.slice(i, i + this.BATCH_SIZE);

      const payload = batch.map((item) => ({
        localCode: item.code,
        unitPrice: item.unitPrice,
        unit: item.unit,
        effectiveDate: new Date().toISOString().split('T')[0],
      }));

      try {
        const response = await fetch(`${portal.portalUrl}/api/vendor/prices`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            'X-Vendor-Id': portal.vendorId,
          },
          body: JSON.stringify({ prices: payload }),
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          processed += batch.length;
        } else {
          failed += batch.length;
          const errorData = await response.json().catch(() => ({}));
          batch.forEach((item) => {
            errors.push({
              itemId: item.id,
              itemCode: item.code,
              error: errorData.error?.message || `HTTP ${response.status}`,
            });
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
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

    return records;
  }

  /**
   * Get VMI-enabled items
   */
  private async getVmiEnabledItems(
    itemIds: number[] | undefined
  ): Promise<Array<{ id: number; code: string }>> {
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

    return records;
  }

  /**
   * Get inventory quantities for items
   */
  private async getInventoryQuantities(itemIds: number[]): Promise<InventoryItem[]> {
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

    return records.map((r: any) => ({
      id: r.id,
      code: r.code,
      quantity: r.quantity || 0,
      unit: r.unit,
    }));
  }

  /**
   * Get catalog items with TPP/TTMT codes
   */
  private async getCatalogItems(itemIds: number[] | undefined): Promise<CatalogItem[]> {
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

    return records;
  }

  /**
   * Get items with prices
   */
  private async getPriceItems(itemIds: number[] | undefined): Promise<PriceItem[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const { items } = this.getTables();

    const conditions = [
      eq(items.vmiSyncEnabled, true),
    ];

    if (itemIds && itemIds.length > 0) {
      conditions.push(inArray(items.id, itemIds));
    }

    const records = await db
      .select({
        id: items.id,
        code: items.code,
        unit: items.primaryUnit,
      })
      .from(items)
      .where(and(...conditions));

    return records.map((r: any) => ({
      id: r.id,
      code: r.code,
      unitPrice: 0, // Price not stored in items table - would need to fetch from pricing table
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

    const now = this.isSqlite ? new Date().toISOString() : new Date();

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

    const now = this.isSqlite ? new Date().toISOString() : new Date();

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
}

// Export singleton instance
export const vmiSyncService = new VmiSyncService();
