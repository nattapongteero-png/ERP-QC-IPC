/**
 * Unit Tests for VMI Webhook Service
 *
 * Tests webhook CRUD operations and delivery tracking
 * Uses schema-sync to create tables from Drizzle ORM schema definitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Create test database
let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

// Mock the database module to use our test database
vi.mock('@/lib/db', async () => {
  return {
    isSqlite: () => true,
    getDb: async () => testDb,
    getSqliteDb: () => testDb,
    markSchemaSynced: () => {},
    schema,
  };
});

// Mock audit to avoid side effects
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import service after mocking
import { VmiWebhookService, VmiWebhookError } from '@/lib/services/vmi-webhook.service';
import type { VmiWebhookCreate, VmiWebhookEventType } from '@/types/vmi';

// Helper function to generate CREATE TABLE SQL from Drizzle schema
function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const columnDefs: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;

    // Map data type
    switch (col.dataType) {
      case 'string':
        def += 'TEXT';
        break;
      case 'number':
        def += 'INTEGER';
        break;
      case 'boolean':
        def += 'INTEGER';
        break;
      default:
        def += 'TEXT';
    }

    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) {
        def += ' AUTOINCREMENT';
      }
    }

    if (col.notNull && !col.primary) {
      def += ' NOT NULL';
    }

    if (col.hasDefault && col.default !== undefined) {
      if (typeof col.default === 'boolean') {
        def += ` DEFAULT ${col.default ? 1 : 0}`;
      } else if (typeof col.default === 'number') {
        def += ` DEFAULT ${col.default}`;
      } else if (typeof col.default === 'string') {
        if (col.default === 'CURRENT_TIMESTAMP') {
          def += ` DEFAULT CURRENT_TIMESTAMP`;
        } else {
          def += ` DEFAULT '${col.default}'`;
        }
      }
    }

    columnDefs.push(def);
  }

  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')})`;
}

describe('VmiWebhookService', () => {
  let service: VmiWebhookService;
  let testPortalId: number;

  const testPortalData = {
    name: 'Test Portal',
    portalUrl: 'https://test-vmi-portal.example.com',
    apiKeyEncrypted: 'test-api-key-encrypted',
    vendorId: 'VENDOR-001',
    isEnabled: true,
    syncInventoryEnabled: true,
    syncInventoryInterval: 60,
    syncItemsEnabled: true,
    syncItemsInterval: 1440,
    syncPricesEnabled: true,
    syncPricesInterval: 1440,
    orderPollingEnabled: true,
    orderPollingInterval: 15,
    connectionStatus: 'connected',
    webhookEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    // Set up encryption key for tests
    if (!process.env.VMI_ENCRYPTION_KEY) {
      process.env.VMI_ENCRYPTION_KEY = 'a'.repeat(64);
    }

    // Create in-memory SQLite database
    sqlite = new Database(':memory:');
    testDb = drizzle(sqlite);

    // Create required tables
    const tablesToCreate = [
      schema.sqliteUsers,
      schema.sqliteVmiPortalConfig,
      schema.sqliteVmiWebhooks,
      schema.sqliteVmiWebhookDeliveries,
    ];

    for (const table of tablesToCreate) {
      const createSql = generateCreateTableSql(table);
      sqlite.exec(createSql);
    }

    service = new VmiWebhookService();

    // Create test portal
    const result = await testDb.insert(schema.sqliteVmiPortalConfig).values(testPortalData);
    testPortalId = result.lastInsertRowid as number;
  });

  afterAll(async () => {
    // Close database
    sqlite.close();
  });

  beforeEach(async () => {
    // Clean up webhooks and deliveries between tests
    await testDb.delete(schema.sqliteVmiWebhookDeliveries);
    await testDb.delete(schema.sqliteVmiWebhooks);
  });

  describe('create', () => {
    it('should create a new webhook and return secret', async () => {
      const input = {
        name: 'Order Notifications',
        description: 'Receive order events',
        events: ['order.created', 'order.cancelled'] as VmiWebhookEventType[],
      };

      const result = await service.create(testPortalId, input);

      expect(result.webhook).toBeDefined();
      expect(result.webhook.name).toBe(input.name);
      expect(result.webhook.description).toBe(input.description);
      expect(result.webhook.events).toEqual(input.events);
      expect(result.webhook.isActive).toBe(true);
      expect(result.webhook.isDisabledByFailures).toBe(false);
      expect(result.webhook.consecutiveFailures).toBe(0);
      expect(result.webhook.healthStatus).toBe('active');
      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBe(64);
    });

    it('should throw error for non-existent portal', async () => {
      const input = {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      };

      await expect(service.create(99999, input)).rejects.toThrow(VmiWebhookError);
      await expect(service.create(99999, input)).rejects.toMatchObject({
        code: 'PORTAL_NOT_FOUND',
        httpStatus: 404,
      });
    });

    it('should enforce max 5 webhooks per portal', async () => {
      const input = {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      };

      // Create 5 webhooks
      for (let i = 0; i < 5; i++) {
        await service.create(testPortalId, { ...input, name: `Webhook ${i}` });
      }

      // 6th should fail
      await expect(service.create(testPortalId, { ...input, name: 'Webhook 5' }))
        .rejects.toMatchObject({
          code: 'WEBHOOK_LIMIT_EXCEEDED',
        });
    });

    it('should encrypt the secret', async () => {
      const input = {
        name: 'Encrypted Test',
        events: ['order.created'] as VmiWebhookEventType[],
      };

      const result = await service.create(testPortalId, input);

      // Get raw record from DB
      const [rawRecord] = await testDb
        .select()
        .from(schema.sqliteVmiWebhooks)
        .where(eq(schema.sqliteVmiWebhooks.id, result.webhook.id));

      expect(rawRecord.secretEncrypted).toBeDefined();
      expect(rawRecord.secretEncrypted).not.toBe(result.secret);
      expect(rawRecord.secretEncrypted).toContain(':'); // Encrypted format
    });
  });

  describe('getById', () => {
    it('should return webhook by ID', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      const found = await service.getById(webhook.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(webhook.id);
      expect(found?.name).toBe('Test Webhook');
    });

    it('should return null for non-existent ID', async () => {
      const found = await service.getById(99999);
      expect(found).toBeNull();
    });
  });

  describe('getByIdWithSecret', () => {
    it('should return webhook with decrypted secret', async () => {
      const { webhook, secret } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      const found = await service.getByIdWithSecret(webhook.id);

      expect(found).toBeDefined();
      expect(found?.decryptedSecret).toBe(secret);
    });
  });

  describe('listByPortal', () => {
    it('should list all webhooks for a portal', async () => {
      await service.create(testPortalId, { name: 'Webhook 1', events: ['order.created'] as VmiWebhookEventType[] });
      await service.create(testPortalId, { name: 'Webhook 2', events: ['order.cancelled'] as VmiWebhookEventType[] });

      const webhooks = await service.listByPortal(testPortalId);

      expect(webhooks).toHaveLength(2);
      expect(webhooks.map(w => w.name)).toContain('Webhook 1');
      expect(webhooks.map(w => w.name)).toContain('Webhook 2');
    });

    it('should return empty array for portal with no webhooks', async () => {
      const webhooks = await service.listByPortal(testPortalId);
      expect(webhooks).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update webhook properties', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Original Name',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      const result = await service.update(webhook.id, {
        name: 'Updated Name',
        description: 'New description',
        events: ['order.created', 'receipt.created'] as VmiWebhookEventType[],
      });

      expect(result.webhook.name).toBe('Updated Name');
      expect(result.webhook.description).toBe('New description');
      expect(result.webhook.events).toEqual(['order.created', 'receipt.created']);
    });

    it('should regenerate secret when requested', async () => {
      const { webhook, secret: originalSecret } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      const result = await service.update(webhook.id, {
        regenerateSecret: true,
      });

      expect(result.newSecret).toBeDefined();
      expect(result.newSecret).not.toBe(originalSecret);
      expect(result.newSecret?.length).toBe(64);
    });

    it('should re-enable auto-disabled webhook', async () => {
      // Create webhook and simulate auto-disable
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Manually set disabled state
      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({
          isDisabledByFailures: true,
          consecutiveFailures: 10,
          isActive: false,
        })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      // Re-enable
      const result = await service.update(webhook.id, {
        reenableWebhook: true,
      });

      expect(result.webhook.isActive).toBe(true);
      expect(result.webhook.isDisabledByFailures).toBe(false);
      expect(result.webhook.consecutiveFailures).toBe(0);
      expect(result.webhook.healthStatus).toBe('active');
    });

    it('should throw error for non-existent webhook', async () => {
      await expect(service.update(99999, { name: 'Test' })).rejects.toMatchObject({
        code: 'WEBHOOK_NOT_FOUND',
        httpStatus: 404,
      });
    });
  });

  describe('delete', () => {
    it('should delete webhook and associated deliveries', async () => {
      const { webhook, secret } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Create a delivery
      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'test-delivery-123',
        eventType: 'order.created',
        payload: '{}',
        signature: 'test-sig',
        signatureValid: true,
      });

      await service.delete(webhook.id);

      // Verify webhook deleted
      const found = await service.getById(webhook.id);
      expect(found).toBeNull();

      // Verify deliveries deleted
      const [delivery] = await testDb
        .select()
        .from(schema.sqliteVmiWebhookDeliveries)
        .where(eq(schema.sqliteVmiWebhookDeliveries.deliveryId, 'test-delivery-123'));
      expect(delivery).toBeUndefined();
    });

    it('should throw error for non-existent webhook', async () => {
      await expect(service.delete(99999)).rejects.toMatchObject({
        code: 'WEBHOOK_NOT_FOUND',
        httpStatus: 404,
      });
    });
  });

  describe('findActiveWebhooksForEvent', () => {
    it('should find active webhooks subscribed to event', async () => {
      await service.create(testPortalId, {
        name: 'Order Webhook',
        events: ['order.created', 'order.cancelled'] as VmiWebhookEventType[],
      });
      await service.create(testPortalId, {
        name: 'Receipt Webhook',
        events: ['receipt.created', 'receipt.completed'] as VmiWebhookEventType[],
      });

      const orderWebhooks = await service.findActiveWebhooksForEvent(testPortalId, 'order.created');
      expect(orderWebhooks).toHaveLength(1);
      expect(orderWebhooks[0].name).toBe('Order Webhook');
      expect(orderWebhooks[0].decryptedSecret).toBeDefined();

      const receiptWebhooks = await service.findActiveWebhooksForEvent(testPortalId, 'receipt.created');
      expect(receiptWebhooks).toHaveLength(1);
      expect(receiptWebhooks[0].name).toBe('Receipt Webhook');
    });

    it('should not return disabled webhooks', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Disabled Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.update(webhook.id, { isActive: false });

      const webhooks = await service.findActiveWebhooksForEvent(testPortalId, 'order.created');
      expect(webhooks).toHaveLength(0);
    });

    it('should not return auto-disabled webhooks', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Auto-disabled Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Simulate auto-disable
      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({ isDisabledByFailures: true })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      const webhooks = await service.findActiveWebhooksForEvent(testPortalId, 'order.created');
      expect(webhooks).toHaveLength(0);
    });
  });

  describe('deliveryExists', () => {
    it('should return true if delivery exists', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'existing-delivery-id',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      const exists = await service.deliveryExists('existing-delivery-id');
      expect(exists).toBe(true);
    });

    it('should return false if delivery does not exist', async () => {
      const exists = await service.deliveryExists('non-existent-delivery-id');
      expect(exists).toBe(false);
    });
  });

  describe('createDelivery', () => {
    it('should create delivery record', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      const deliveryId = await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'new-delivery-123',
        eventType: 'order.created',
        eventId: 'event-456',
        payload: '{"orderId":123}',
        signature: 'test-signature',
        signatureValid: true,
      });

      expect(deliveryId).toBeGreaterThan(0);

      const [record] = await testDb
        .select()
        .from(schema.sqliteVmiWebhookDeliveries)
        .where(eq(schema.sqliteVmiWebhookDeliveries.deliveryId, 'new-delivery-123'));

      expect(record).toBeDefined();
      expect(record.status).toBe('pending');
      expect(record.eventType).toBe('order.created');
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should update delivery status to processed', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'status-test-delivery',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      await service.updateDeliveryStatus(
        'status-test-delivery',
        'processed',
        200,
        150
      );

      const [record] = await testDb
        .select()
        .from(schema.sqliteVmiWebhookDeliveries)
        .where(eq(schema.sqliteVmiWebhookDeliveries.deliveryId, 'status-test-delivery'));

      expect(record.status).toBe('processed');
      expect(record.responseCode).toBe(200);
      expect(record.processingDurationMs).toBe(150);
      expect(record.processedAt).toBeDefined();
    });

    it('should update delivery status to failed with error', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'failed-delivery',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      await service.updateDeliveryStatus(
        'failed-delivery',
        'failed',
        500,
        100,
        'Internal server error'
      );

      const [record] = await testDb
        .select()
        .from(schema.sqliteVmiWebhookDeliveries)
        .where(eq(schema.sqliteVmiWebhookDeliveries.deliveryId, 'failed-delivery'));

      expect(record.status).toBe('failed');
      expect(record.errorMessage).toBe('Internal server error');
    });
  });

  describe('recordSuccess', () => {
    it('should reset consecutive failures on success', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Set some failures
      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({ consecutiveFailures: 5, lastErrorMessage: 'Previous error' })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      await service.recordSuccess(webhook.id);

      const updated = await service.getById(webhook.id);
      expect(updated?.consecutiveFailures).toBe(0);
    });
  });

  describe('recordFailure', () => {
    it('should increment consecutive failures', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.recordFailure(webhook.id, 'Connection timeout');

      const updated = await service.getById(webhook.id);
      expect(updated?.consecutiveFailures).toBe(1);
    });

    it('should auto-disable after 10 consecutive failures', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Set to 9 failures
      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({ consecutiveFailures: 9 })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      // 10th failure
      await service.recordFailure(webhook.id, 'Final error');

      const updated = await service.getById(webhook.id);
      expect(updated?.consecutiveFailures).toBe(10);
      expect(updated?.isDisabledByFailures).toBe(true);
      expect(updated?.healthStatus).toBe('disabled_by_failures');
    });
  });

  describe('getDeliveryHistory', () => {
    it('should return paginated delivery history', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      // Create multiple deliveries
      for (let i = 0; i < 15; i++) {
        await service.createDelivery({
          webhookId: webhook.id,
          deliveryId: `delivery-${i}`,
          eventType: 'order.created',
          payload: '{}',
          signature: 'sig',
          signatureValid: true,
        });
      }

      const page1 = await service.getDeliveryHistory(webhook.id, {
        page: 1,
        pageSize: 10,
      });

      expect(page1.deliveries).toHaveLength(10);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(10);

      const page2 = await service.getDeliveryHistory(webhook.id, {
        page: 2,
        pageSize: 10,
      });

      expect(page2.deliveries).toHaveLength(5);
    });

    it('should filter by status', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'pending-1',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'processed-1',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });
      await service.updateDeliveryStatus('processed-1', 'processed', 200, 100);

      const pending = await service.getDeliveryHistory(webhook.id, { status: 'pending' });
      expect(pending.total).toBe(1);

      const processed = await service.getDeliveryHistory(webhook.id, { status: 'processed' });
      expect(processed.total).toBe(1);
    });

    it('should filter by event type', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Test Webhook',
        events: ['order.created', 'order.cancelled'] as VmiWebhookEventType[],
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'created-1',
        eventType: 'order.created',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      await service.createDelivery({
        webhookId: webhook.id,
        deliveryId: 'cancelled-1',
        eventType: 'order.cancelled',
        payload: '{}',
        signature: 'sig',
        signatureValid: true,
      });

      const created = await service.getDeliveryHistory(webhook.id, { eventType: 'order.created' });
      expect(created.total).toBe(1);
      expect(created.deliveries[0].eventType).toBe('order.created');
    });
  });

  describe('healthStatus computation', () => {
    it('should return "active" for healthy webhook', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Healthy Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      expect(webhook.healthStatus).toBe('active');
    });

    it('should return "warning" after 3 consecutive failures', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Warning Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({ consecutiveFailures: 3 })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      const updated = await service.getById(webhook.id);
      expect(updated?.healthStatus).toBe('warning');
    });

    it('should return "disabled_manual" when manually disabled', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Manual Disabled Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await service.update(webhook.id, { isActive: false });

      const updated = await service.getById(webhook.id);
      expect(updated?.healthStatus).toBe('disabled_manual');
    });

    it('should return "disabled_by_failures" when auto-disabled', async () => {
      const { webhook } = await service.create(testPortalId, {
        name: 'Auto Disabled Webhook',
        events: ['order.created'] as VmiWebhookEventType[],
      });

      await testDb
        .update(schema.sqliteVmiWebhooks)
        .set({ isDisabledByFailures: true, isActive: true })
        .where(eq(schema.sqliteVmiWebhooks.id, webhook.id));

      const updated = await service.getById(webhook.id);
      expect(updated?.healthStatus).toBe('disabled_by_failures');
    });
  });
});
