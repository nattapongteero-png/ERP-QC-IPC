/**
 * VMI Webhook Service
 *
 * Service for managing webhook configurations and deliveries.
 * Handles webhook registration, secret management, and delivery tracking.
 *
 * Feature: 012-vmi-webhook
 */

import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { isSqlite, getSqliteDb, getMysqlDb } from '@/lib/db';
import {
  sqliteVmiWebhooks,
  mysqlVmiWebhooks,
  sqliteVmiWebhookDeliveries,
  mysqlVmiWebhookDeliveries,
  sqliteVmiPortalConfig,
  mysqlVmiPortalConfig,
  type VmiWebhookDb,
  type NewVmiWebhookDb,
  type VmiWebhookDeliveryDb,
  type NewVmiWebhookDeliveryDb,
} from '@/lib/db/schema';
import { encrypt, decrypt, isValidCiphertext } from '@/lib/crypto/encrypt';
import { generateWebhookSecret } from './vmi-webhook-crypto';
import type {
  VmiWebhookEventType,
  VmiWebhookHealthStatus,
  VmiWebhookResponse,
  VmiWebhookDeliveryResponse,
  VmiWebhookCreate,
  VmiWebhookUpdate,
  computeWebhookHealthStatus,
} from '@/types/vmi';
import { getNow, toDateSafe, formatDateFromDb } from '@/lib/db/date-utils';

// ============================================
// Constants
// ============================================

const MAX_WEBHOOKS_PER_PORTAL = 5;
const CONSECUTIVE_FAILURES_THRESHOLD = 10;
const WARNING_FAILURES_THRESHOLD = 3;

// ============================================
// Error Classes
// ============================================

export class VmiWebhookError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number = 400) {
    super(message);
    this.name = 'VmiWebhookError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

// ============================================
// Service Implementation
// ============================================

export class VmiWebhookService {
  private readonly isSqlite: boolean;

  constructor() {
    this.isSqlite = isSqlite();
  }

  /**
   * Get the appropriate database connection
   */
  private async getDb() {
    return this.isSqlite ? getSqliteDb() : await getMysqlDb();
  }

  /**
   * Get the appropriate webhook table
   */
  private getWebhookTable() {
    return this.isSqlite ? sqliteVmiWebhooks : mysqlVmiWebhooks;
  }

  /**
   * Get the appropriate delivery table
   */
  private getDeliveryTable() {
    return this.isSqlite ? sqliteVmiWebhookDeliveries : mysqlVmiWebhookDeliveries;
  }

  /**
   * Get the appropriate portal config table
   */
  private getPortalConfigTable() {
    return this.isSqlite ? sqliteVmiPortalConfig : mysqlVmiPortalConfig;
  }

  /**
   * Compute health status based on webhook state
   */
  private computeHealthStatus(
    isActive: boolean,
    isDisabledByFailures: boolean,
    consecutiveFailures: number
  ): VmiWebhookHealthStatus {
    if (isDisabledByFailures) return 'disabled_by_failures';
    if (!isActive) return 'disabled_manual';
    if (consecutiveFailures >= WARNING_FAILURES_THRESHOLD) return 'warning';
    return 'active';
  }

  /**
   * Transform database record to response format
   */
  private toResponse(record: VmiWebhookDb): VmiWebhookResponse {
    const events = typeof record.events === 'string'
      ? JSON.parse(record.events) as VmiWebhookEventType[]
      : record.events as VmiWebhookEventType[];

    return {
      id: record.id,
      portalId: record.portalId,
      vmiWebhookId: record.vmiWebhookId ?? null,
      name: record.name,
      description: record.description ?? null,
      url: record.url,
      events,
      isActive: record.isActive,
      isDisabledByFailures: record.isDisabledByFailures,
      consecutiveFailures: record.consecutiveFailures,
      lastSuccessAt: record.lastSuccessAt
        ? formatDateFromDb(record.lastSuccessAt)
        : null,
      lastFailureAt: record.lastFailureAt
        ? formatDateFromDb(record.lastFailureAt)
        : null,
      healthStatus: this.computeHealthStatus(
        record.isActive,
        record.isDisabledByFailures,
        record.consecutiveFailures
      ),
      createdAt: typeof record.createdAt === 'string'
        ? record.createdAt
        : (record.createdAt as Date).toISOString(),
    };
  }

  /**
   * Transform delivery record to response format
   */
  private toDeliveryResponse(record: VmiWebhookDeliveryDb): VmiWebhookDeliveryResponse {
    return {
      id: record.id,
      deliveryId: record.deliveryId,
      eventType: record.eventType as VmiWebhookEventType,
      eventId: record.eventId ?? null,
      signatureValid: record.signatureValid,
      status: record.status as 'pending' | 'processed' | 'failed',
      responseCode: record.responseCode ?? null,
      errorMessage: record.errorMessage ?? null,
      processingDurationMs: record.processingDurationMs ?? null,
      receivedAt: typeof record.receivedAt === 'string'
        ? record.receivedAt
        : (record.receivedAt as Date).toISOString(),
      processedAt: record.processedAt
        ? (typeof record.processedAt === 'string'
            ? record.processedAt
            : (record.processedAt as Date).toISOString())
        : null,
    };
  }

  // ============================================
  // Webhook CRUD Operations
  // ============================================

  /**
   * List all webhooks for a portal
   */
  async listByPortal(portalId: number): Promise<VmiWebhookResponse[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    const records = await db
      .select()
      .from(table)
      .where(eq(table.portalId, portalId));

    return records.map((record: VmiWebhookDb) => this.toResponse(record));
  }

  /**
   * Get webhook by ID
   */
  async getById(id: number): Promise<VmiWebhookResponse | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    const [record] = await db.select().from(table).where(eq(table.id, id));
    return record ? this.toResponse(record) : null;
  }

  /**
   * Get webhook by ID with decrypted secret (for internal use)
   */
  async getByIdWithSecret(id: number): Promise<(VmiWebhookDb & { decryptedSecret: string }) | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    const [record] = await db.select().from(table).where(eq(table.id, id));
    if (!record) return null;

    let decryptedSecret = '';
    if (record.secretEncrypted) {
      if (isValidCiphertext(record.secretEncrypted)) {
        decryptedSecret = decrypt(record.secretEncrypted);
      } else {
        // Legacy plain text - use as-is
        decryptedSecret = record.secretEncrypted;
      }
    }

    return {
      ...record,
      decryptedSecret,
    };
  }

  /**
   * Find active webhooks for a portal and event type
   */
  async findActiveWebhooksForEvent(
    portalId: number,
    eventType: VmiWebhookEventType
  ): Promise<Array<VmiWebhookDb & { decryptedSecret: string }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    const records = await db
      .select()
      .from(table)
      .where(
        and(
          eq(table.portalId, portalId),
          eq(table.isActive, true),
          eq(table.isDisabledByFailures, false)
        )
      );

    // Filter by event type (stored as JSON array)
    const matchingWebhooks = records.filter((record: VmiWebhookDb) => {
      const events = typeof record.events === 'string'
        ? JSON.parse(record.events) as VmiWebhookEventType[]
        : record.events as VmiWebhookEventType[];
      return events.includes(eventType);
    });

    // Decrypt secrets
    return matchingWebhooks.map((record: VmiWebhookDb) => {
      let decryptedSecret = '';
      if (record.secretEncrypted) {
        if (isValidCiphertext(record.secretEncrypted)) {
          decryptedSecret = decrypt(record.secretEncrypted);
        } else {
          decryptedSecret = record.secretEncrypted;
        }
      }
      return { ...record, decryptedSecret };
    });
  }

  /**
   * Create a new webhook
   * Returns the webhook response AND the plaintext secret (shown once)
   */
  async create(
    portalId: number,
    input: VmiWebhookCreate,
    createdBy?: number
  ): Promise<{ webhook: VmiWebhookResponse; secret: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();
    const portalTable = this.getPortalConfigTable();

    // Verify portal exists
    const [portal] = await db
      .select()
      .from(portalTable)
      .where(eq(portalTable.id, portalId));

    if (!portal) {
      throw new VmiWebhookError('PORTAL_NOT_FOUND', 'Portal not found', 404);
    }

    // Check webhook limit per portal
    const existingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.portalId, portalId));

    const count = Number(existingCount[0]?.count ?? 0);
    if (count >= MAX_WEBHOOKS_PER_PORTAL) {
      throw new VmiWebhookError(
        'WEBHOOK_LIMIT_EXCEEDED',
        `Maximum ${MAX_WEBHOOKS_PER_PORTAL} webhooks per portal`,
        400
      );
    }

    // Generate secret and URL
    const secret = generateWebhookSecret();
    const encryptedSecret = encrypt(secret);

    // Construct webhook URL based on portal
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const webhookUrl = `${baseUrl}/api/sales/vmi-orders/webhooks/${portalId}`;

    const now = getNow() as string;

    const newRecord: NewVmiWebhookDb = {
      portalId,
      name: input.name,
      description: input.description ?? null,
      url: webhookUrl,
      secretEncrypted: encryptedSecret,
      events: JSON.stringify(input.events),
      isActive: true,
      isDisabledByFailures: false,
      consecutiveFailures: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
    };

    const result = await db.insert(table).values(newRecord);
    const insertedId = this.isSqlite
      ? (result as { lastInsertRowid: number }).lastInsertRowid
      : (result as [{ insertId: number }])[0].insertId;

    const webhook = await this.getById(insertedId);
    if (!webhook) {
      throw new VmiWebhookError('CREATE_FAILED', 'Failed to create webhook', 500);
    }

    return { webhook, secret };
  }

  /**
   * Update a webhook
   * If regenerateSecret is true, returns new secret
   */
  async update(
    id: number,
    input: VmiWebhookUpdate
  ): Promise<{ webhook: VmiWebhookResponse; newSecret?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    // Verify webhook exists
    const [existing] = await db.select().from(table).where(eq(table.id, id));
    if (!existing) {
      throw new VmiWebhookError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404);
    }

    const now = getNow();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      updatedAt: now,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.events !== undefined) updateData.events = JSON.stringify(input.events);
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    // Handle re-enable webhook after auto-disable
    if (input.reenableWebhook && existing.isDisabledByFailures) {
      updateData.isDisabledByFailures = false;
      updateData.consecutiveFailures = 0;
      updateData.isActive = true;
    }

    // Handle secret regeneration
    let newSecret: string | undefined;
    if (input.regenerateSecret) {
      newSecret = generateWebhookSecret();
      updateData.secretEncrypted = encrypt(newSecret);
    }

    await db.update(table).set(updateData).where(eq(table.id, id));

    const webhook = await this.getById(id);
    if (!webhook) {
      throw new VmiWebhookError('UPDATE_FAILED', 'Failed to update webhook', 500);
    }

    return { webhook, newSecret };
  }

  /**
   * Delete a webhook
   */
  async delete(id: number): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();
    const deliveryTable = this.getDeliveryTable();

    // Verify webhook exists
    const [existing] = await db.select().from(table).where(eq(table.id, id));
    if (!existing) {
      throw new VmiWebhookError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404);
    }

    // Delete deliveries first (FK constraint)
    await db.delete(deliveryTable).where(eq(deliveryTable.webhookId, id));

    // Delete webhook
    await db.delete(table).where(eq(table.id, id));
  }

  // ============================================
  // Delivery Tracking Operations
  // ============================================

  /**
   * Check if delivery already exists (idempotency)
   */
  async deliveryExists(deliveryId: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getDeliveryTable();

    const [existing] = await db
      .select()
      .from(table)
      .where(eq(table.deliveryId, deliveryId));

    return !!existing;
  }

  /**
   * Create delivery record
   */
  async createDelivery(data: {
    webhookId: number;
    deliveryId: string;
    eventType: VmiWebhookEventType;
    eventId?: string;
    payload: string;
    signature: string;
    signatureValid: boolean;
  }): Promise<number> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getDeliveryTable();

    const now = getNow() as string;

    const newRecord: NewVmiWebhookDeliveryDb = {
      webhookId: data.webhookId,
      deliveryId: data.deliveryId,
      eventType: data.eventType,
      eventId: data.eventId ?? null,
      payload: data.payload,
      signature: data.signature,
      signatureValid: data.signatureValid,
      status: 'pending',
      receivedAt: now,
    };

    const result = await db.insert(table).values(newRecord);
    return this.isSqlite
      ? (result as { lastInsertRowid: number }).lastInsertRowid
      : (result as [{ insertId: number }])[0].insertId;
  }

  /**
   * Update delivery status after processing
   */
  async updateDeliveryStatus(
    deliveryId: string,
    status: 'processed' | 'failed',
    responseCode: number,
    processingDurationMs: number,
    errorMessage?: string
  ): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getDeliveryTable();

    const now = getNow();

    await db
      .update(table)
      .set({
        status,
        responseCode,
        processingDurationMs,
        errorMessage: errorMessage ?? null,
        processedAt: now,
      })
      .where(eq(table.deliveryId, deliveryId));
  }

  /**
   * Record webhook success - reset failure count
   */
  async recordSuccess(webhookId: number): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    const now = getNow();

    await db
      .update(table)
      .set({
        consecutiveFailures: 0,
        lastSuccessAt: now,
        lastErrorMessage: null,
        updatedAt: now,
      })
      .where(eq(table.id, webhookId));
  }

  /**
   * Record webhook failure - increment failure count
   * Auto-disable if threshold reached
   */
  async recordFailure(webhookId: number, errorMessage: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getWebhookTable();

    // Get current failure count
    const [webhook] = await db.select().from(table).where(eq(table.id, webhookId));
    if (!webhook) return;

    const newFailureCount = webhook.consecutiveFailures + 1;
    const shouldAutoDisable = newFailureCount >= CONSECUTIVE_FAILURES_THRESHOLD;

    const now = getNow();

    await db
      .update(table)
      .set({
        consecutiveFailures: newFailureCount,
        lastFailureAt: now,
        lastErrorMessage: errorMessage,
        isDisabledByFailures: shouldAutoDisable,
        updatedAt: now,
      })
      .where(eq(table.id, webhookId));
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: number,
    options: {
      status?: 'pending' | 'processed' | 'failed';
      eventType?: VmiWebhookEventType;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ): Promise<{
    deliveries: VmiWebhookDeliveryResponse[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await this.getDb()) as any;
    const table = this.getDeliveryTable();

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    // Build conditions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(table.webhookId, webhookId)];

    if (options.status) {
      conditions.push(eq(table.status, options.status));
    }
    if (options.eventType) {
      conditions.push(eq(table.eventType, options.eventType));
    }
    if (options.dateFrom) {
      const fromDate = this.isSqlite ? options.dateFrom : new Date(options.dateFrom);
      conditions.push(gte(table.receivedAt, fromDate));
    }
    if (options.dateTo) {
      const toDate = this.isSqlite ? options.dateTo : new Date(options.dateTo);
      conditions.push(lte(table.receivedAt, toDate));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(and(...conditions));
    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated results
    const records = await db
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(desc(table.receivedAt))
      .limit(pageSize)
      .offset(offset);

    return {
      deliveries: records.map((r: VmiWebhookDeliveryDb) => this.toDeliveryResponse(r)),
      total,
      page,
      pageSize,
    };
  }
}

// Export singleton instance
export const vmiWebhookService = new VmiWebhookService();
