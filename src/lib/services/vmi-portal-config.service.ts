/**
 * VMI Portal Config Service
 *
 * Service for managing VMI Portal configurations.
 * This system IS the vendor - we configure connections TO external VMI portals.
 *
 * Feature: 008-vmi-vendor-sync
 */

import { eq } from 'drizzle-orm';
import { useSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteVmiPortalConfig,
  mysqlVmiPortalConfig,
  type VmiPortalConfig,
  type NewVmiPortalConfig,
} from '@/lib/db/schema';
import { encrypt, decrypt, isValidCiphertext } from '@/lib/crypto/encrypt';
import type {
  VmiPortalConfigInput,
  VmiPortalConfigUpdate,
  VmiPortalTestResult,
  VmiConnectionStatus,
} from '@/types/vmi';

// ============================================
// Error Classes
// ============================================

export class VmiPortalConfigError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number = 400) {
    super(message);
    this.name = 'VmiPortalConfigError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================
// Types
// ============================================

export interface VmiPortalConfigSummary {
  id: number;
  name: string;
  portalUrl: string;
  vendorId: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  syncInventoryEnabled: boolean;
  syncItemsEnabled: boolean;
  syncPricesEnabled: boolean;
  orderPollingEnabled: boolean;
  connectionStatus: VmiConnectionStatus;
  lastErrorMessage?: string | null;
  lastInventorySyncAt?: string | null;
  lastItemsSyncAt?: string | null;
  lastPricesSyncAt?: string | null;
  lastOrdersPollAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Portal Config Service
// ============================================

export class VmiPortalConfigService {
  private readonly isSqlite: boolean;

  constructor() {
    this.isSqlite = useSqlite();
  }

  /**
   * Get the appropriate database connection
   */
  private async getDb() {
    return this.isSqlite ? getSqliteDb() : await getMysqlDb();
  }

  /**
   * Get the appropriate schema table
   */
  private getTable() {
    return this.isSqlite ? sqliteVmiPortalConfig : mysqlVmiPortalConfig;
  }

  /**
   * Transform database record to summary (without decrypted API key)
   */
  private toSummary(record: VmiPortalConfig): VmiPortalConfigSummary {
    return {
      id: record.id,
      name: record.name,
      portalUrl: record.portalUrl,
      vendorId: record.vendorId,
      isEnabled: record.isEnabled,
      hasApiKey: !!record.apiKeyEncrypted && isValidCiphertext(record.apiKeyEncrypted),
      syncInventoryEnabled: record.syncInventoryEnabled,
      syncItemsEnabled: record.syncItemsEnabled,
      syncPricesEnabled: record.syncPricesEnabled,
      orderPollingEnabled: record.orderPollingEnabled,
      connectionStatus: record.connectionStatus as VmiConnectionStatus,
      lastErrorMessage: record.lastErrorMessage,
      lastInventorySyncAt: record.lastInventorySyncAt,
      lastItemsSyncAt: record.lastItemsSyncAt,
      lastPricesSyncAt: record.lastPricesSyncAt,
      lastOrdersPollAt: record.lastOrdersPollAt,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : record.createdAt.toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : record.updatedAt.toISOString(),
    };
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * List all portal configurations
   */
  async list(): Promise<VmiPortalConfigSummary[]> {
    const db = await this.getDb();
    const table = this.getTable();

    const records = await db.select().from(table);
    return records.map((record) => this.toSummary(record));
  }

  /**
   * Get portal configuration by ID
   */
  async getById(id: number): Promise<VmiPortalConfigSummary | null> {
    const db = await this.getDb();
    const table = this.getTable();

    const [record] = await db.select().from(table).where(eq(table.id, id));
    return record ? this.toSummary(record) : null;
  }

  /**
   * Get portal configuration with decrypted API key (for internal use only)
   */
  async getByIdWithApiKey(id: number): Promise<(VmiPortalConfig & { decryptedApiKey: string }) | null> {
    const db = await this.getDb();
    const table = this.getTable();

    const [record] = await db.select().from(table).where(eq(table.id, id));
    if (!record) return null;

    return {
      ...record,
      decryptedApiKey: decrypt(record.apiKeyEncrypted),
    };
  }

  /**
   * Get all enabled portal configurations with decrypted API keys
   */
  async getEnabledWithApiKeys(): Promise<Array<VmiPortalConfig & { decryptedApiKey: string }>> {
    const db = await this.getDb();
    const table = this.getTable();

    const records = await db.select().from(table).where(eq(table.isEnabled, true));
    return records.map((record) => ({
      ...record,
      decryptedApiKey: decrypt(record.apiKeyEncrypted),
    }));
  }

  /**
   * Create new portal configuration
   */
  async create(input: VmiPortalConfigInput, userId?: number): Promise<VmiPortalConfigSummary> {
    const db = await this.getDb();
    const table = this.getTable();

    // Validate portal URL
    if (!input.portalUrl.startsWith('https://')) {
      throw new VmiPortalConfigError('INVALID_URL', 'Portal URL must use HTTPS');
    }

    // Encrypt API key
    const apiKeyEncrypted = encrypt(input.apiKey);

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    const newRecord: NewVmiPortalConfig = {
      name: input.name,
      portalUrl: input.portalUrl,
      apiKeyEncrypted,
      vendorId: input.vendorId,
      isEnabled: input.isEnabled ?? true,
      syncInventoryEnabled: input.syncInventoryEnabled ?? true,
      syncInventoryInterval: input.syncInventoryInterval ?? 60,
      syncItemsEnabled: input.syncItemsEnabled ?? true,
      syncItemsInterval: input.syncItemsInterval ?? 1440,
      syncPricesEnabled: input.syncPricesEnabled ?? true,
      syncPricesInterval: input.syncPricesInterval ?? 1440,
      orderPollingEnabled: input.orderPollingEnabled ?? true,
      orderPollingInterval: input.orderPollingInterval ?? 15,
      connectionStatus: 'disconnected',
      createdBy: userId,
      updatedBy: userId,
      createdAt: now as any,
      updatedAt: now as any,
    };

    const [insertedId] = await db.insert(table).values(newRecord as any).$returningId();
    const created = await this.getById(insertedId.id);
    if (!created) {
      throw new VmiPortalConfigError('CREATE_FAILED', 'Failed to create portal configuration', 500);
    }

    return created;
  }

  /**
   * Update portal configuration
   */
  async update(id: number, input: VmiPortalConfigUpdate, userId?: number): Promise<VmiPortalConfigSummary> {
    const db = await this.getDb();
    const table = this.getTable();

    // Check if exists
    const existing = await this.getById(id);
    if (!existing) {
      throw new VmiPortalConfigError('NOT_FOUND', `Portal configuration ${id} not found`, 404);
    }

    // Validate portal URL if provided
    if (input.portalUrl && !input.portalUrl.startsWith('https://')) {
      throw new VmiPortalConfigError('INVALID_URL', 'Portal URL must use HTTPS');
    }

    const updateData: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: this.isSqlite ? new Date().toISOString() : new Date(),
    };

    // Copy allowed fields
    if (input.name !== undefined) updateData.name = input.name;
    if (input.portalUrl !== undefined) updateData.portalUrl = input.portalUrl;
    if (input.vendorId !== undefined) updateData.vendorId = input.vendorId;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;
    if (input.syncInventoryEnabled !== undefined) updateData.syncInventoryEnabled = input.syncInventoryEnabled;
    if (input.syncInventoryInterval !== undefined) updateData.syncInventoryInterval = input.syncInventoryInterval;
    if (input.syncItemsEnabled !== undefined) updateData.syncItemsEnabled = input.syncItemsEnabled;
    if (input.syncItemsInterval !== undefined) updateData.syncItemsInterval = input.syncItemsInterval;
    if (input.syncPricesEnabled !== undefined) updateData.syncPricesEnabled = input.syncPricesEnabled;
    if (input.syncPricesInterval !== undefined) updateData.syncPricesInterval = input.syncPricesInterval;
    if (input.orderPollingEnabled !== undefined) updateData.orderPollingEnabled = input.orderPollingEnabled;
    if (input.orderPollingInterval !== undefined) updateData.orderPollingInterval = input.orderPollingInterval;

    // Encrypt new API key if provided
    if (input.apiKey) {
      updateData.apiKeyEncrypted = encrypt(input.apiKey);
    }

    await db.update(table).set(updateData).where(eq(table.id, id));

    const updated = await this.getById(id);
    if (!updated) {
      throw new VmiPortalConfigError('UPDATE_FAILED', 'Failed to update portal configuration', 500);
    }

    return updated;
  }

  /**
   * Delete portal configuration
   */
  async delete(id: number): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    // Check if exists
    const existing = await this.getById(id);
    if (!existing) {
      throw new VmiPortalConfigError('NOT_FOUND', `Portal configuration ${id} not found`, 404);
    }

    await db.delete(table).where(eq(table.id, id));
  }

  // ============================================
  // Connection Testing
  // ============================================

  /**
   * Test connection to VMI Portal
   */
  async testConnection(id: number): Promise<VmiPortalTestResult> {
    const config = await this.getByIdWithApiKey(id);
    if (!config) {
      throw new VmiPortalConfigError('NOT_FOUND', `Portal configuration ${id} not found`, 404);
    }

    const startTime = Date.now();

    try {
      // Make a test request to the portal's health/info endpoint
      const response = await fetch(`${config.portalUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.decryptedApiKey,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        // Update connection status to connected
        await this.updateConnectionStatus(id, 'connected');

        // Try to get vendor info from response
        let vendorInfo: VmiPortalTestResult['vendorInfo'];
        try {
          const data = await response.json();
          if (data.vendorId && data.vendorName) {
            vendorInfo = {
              vendorId: data.vendorId,
              vendorName: data.vendorName,
            };
          }
        } catch {
          // Ignore JSON parse errors
        }

        return {
          connected: true,
          latencyMs,
          vendorInfo,
        };
      } else {
        const errorText = await response.text();
        await this.updateConnectionStatus(id, 'error', `HTTP ${response.status}: ${errorText}`);

        return {
          connected: false,
          latencyMs,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.updateConnectionStatus(id, 'error', errorMessage);

      return {
        connected: false,
        latencyMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Update connection status
   */
  async updateConnectionStatus(id: number, status: VmiConnectionStatus, errorMessage?: string): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    const updateData: Record<string, unknown> = {
      connectionStatus: status,
      updatedAt: this.isSqlite ? new Date().toISOString() : new Date(),
    };

    if (status === 'error' && errorMessage) {
      updateData.lastErrorMessage = errorMessage;
    } else if (status === 'connected') {
      updateData.lastErrorMessage = null;
    }

    await db.update(table).set(updateData).where(eq(table.id, id));
  }

  // ============================================
  // Sync Timestamp Updates
  // ============================================

  /**
   * Update last inventory sync timestamp
   */
  async updateLastInventorySync(id: number): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    await db
      .update(table)
      .set({
        lastInventorySyncAt: now as any,
        updatedAt: now as any,
      })
      .where(eq(table.id, id));
  }

  /**
   * Update last items sync timestamp
   */
  async updateLastItemsSync(id: number): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    await db
      .update(table)
      .set({
        lastItemsSyncAt: now as any,
        updatedAt: now as any,
      })
      .where(eq(table.id, id));
  }

  /**
   * Update last prices sync timestamp
   */
  async updateLastPricesSync(id: number): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    await db
      .update(table)
      .set({
        lastPricesSyncAt: now as any,
        updatedAt: now as any,
      })
      .where(eq(table.id, id));
  }

  /**
   * Update last orders poll timestamp
   */
  async updateLastOrdersPoll(id: number): Promise<void> {
    const db = await this.getDb();
    const table = this.getTable();

    const now = this.isSqlite ? new Date().toISOString() : new Date();

    await db
      .update(table)
      .set({
        lastOrdersPollAt: now as any,
        updatedAt: now as any,
      })
      .where(eq(table.id, id));
  }
}

// Export singleton instance
export const vmiPortalConfigService = new VmiPortalConfigService();
