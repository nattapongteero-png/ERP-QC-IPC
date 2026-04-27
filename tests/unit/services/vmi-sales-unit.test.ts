/**
 * VMI Portal + Sales Order Unit Tests
 *
 * 1. Webhook crypto: signature generation, validation, replay protection
 * 2. VMI Portal service: construction patterns
 * 3. VMI -> Sales Order creation (createSalesOrderFromVmi)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/inventory.service', () => ({
  getLotsForPicking: vi.fn(() => Promise.resolve([])),
  reserveLots: vi.fn(() => Promise.resolve()),
  issueMaterial: vi.fn(() => Promise.resolve()),
  receiveMaterial: vi.fn(() => Promise.resolve(1)),
}));

vi.mock('@/lib/services/unit-cost.service', () => ({
  calculateCOGS: vi.fn(() => Promise.resolve({ unitCost: 50, totalCost: 500, marginAmount: 500, marginPercent: 50 })),
  updateSOLineWithCOGS: vi.fn(() => Promise.resolve()),
  recalculateWAC: vi.fn(() => Promise.resolve({ success: true })),
  updateItemLastPurchase: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })),
}));

import {
  generateWebhookSecret,
  computeSignature,
  validateSignature,
  validateWebhookRequest,
  createSignedTestPayload,
} from '@/lib/services/vmi-webhook-crypto';

import { createSalesOrderFromVmi } from '@/lib/services/sales.service';

const REQUIRED_TABLES = [
  schema.sqliteItems, schema.sqliteWarehouses,
  schema.sqliteInventoryLots, schema.sqliteInventoryTransactions,
  schema.sqliteSalesOrders, schema.sqliteSalesOrderLines, schema.sqliteSalesDeliveries,
  schema.sqliteUsers, schema.sqliteAuditTrail,
  schema.sqliteVendors, schema.sqliteCustomers,
];

// ============================================
// 1. Webhook Crypto
// ============================================
describe('VMI Webhook Crypto', () => {
  describe('generateWebhookSecret', () => {
    it('should generate 64-char hex string', () => {
      const secret = generateWebhookSecret();
      expect(secret).toHaveLength(64);
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique secrets', () => {
      expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
    });
  });

  describe('computeSignature', () => {
    it('should compute HMAC-SHA256', () => {
      const sig = computeSignature('1234567890', '{"event":"test"}', 'mysecret');
      expect(sig).toHaveLength(64);
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should be deterministic', () => {
      const a = computeSignature('1234567890', '{"a":1}', 'key');
      const b = computeSignature('1234567890', '{"a":1}', 'key');
      expect(a).toBe(b);
    });

    it('should differ for different timestamps', () => {
      const a = computeSignature('1111111111', '{}', 'key');
      const b = computeSignature('2222222222', '{}', 'key');
      expect(a).not.toBe(b);
    });

    it('should differ for different payloads', () => {
      const a = computeSignature('1234567890', '{"a":1}', 'key');
      const b = computeSignature('1234567890', '{"a":2}', 'key');
      expect(a).not.toBe(b);
    });

    it('should differ for different secrets', () => {
      const a = computeSignature('1234567890', '{}', 'key1');
      const b = computeSignature('1234567890', '{}', 'key2');
      expect(a).not.toBe(b);
    });
  });

  describe('validateSignature', () => {
    const secret = generateWebhookSecret();
    const payload = JSON.stringify({ event: 'order.created', orderId: 123 });

    it('should accept valid signature', () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      const sig = computeSignature(ts, payload, secret);
      expect(validateSignature(sig, ts, payload, secret).valid).toBe(true);
    });

    it('should reject wrong signature', () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      expect(validateSignature('badsig', ts, payload, secret).valid).toBe(false);
    });

    it('should reject old timestamp (replay)', () => {
      const old = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();
      const sig = computeSignature(old, payload, secret);
      const r = validateSignature(sig, old, payload, secret);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('old');
    });

    it('should reject future timestamp', () => {
      const future = Math.floor((Date.now() + 10 * 60 * 1000) / 1000).toString();
      const sig = computeSignature(future, payload, secret);
      const r = validateSignature(sig, future, payload, secret);
      expect(r.valid).toBe(false);
      expect(r.error).toContain('future');
    });

    it('should reject non-numeric timestamp', () => {
      expect(validateSignature('sig', 'abc', payload, secret).valid).toBe(false);
    });
  });

  describe('validateWebhookRequest', () => {
    const secret = generateWebhookSecret();
    const payload = JSON.stringify({ event: 'order.created' });

    it('should validate correct headers', () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      const sig = computeSignature(ts, payload, secret);
      expect(validateWebhookRequest({ 'x-webhook-signature': sig, 'x-webhook-timestamp': ts }, payload, secret).valid).toBe(true);
    });

    it('should reject missing signature', () => {
      const ts = Math.floor(Date.now() / 1000).toString();
      expect(validateWebhookRequest({ 'x-webhook-timestamp': ts }, payload, secret).valid).toBe(false);
    });

    it('should reject missing timestamp', () => {
      expect(validateWebhookRequest({ 'x-webhook-signature': 'sig' }, payload, secret).valid).toBe(false);
    });
  });

  describe('createSignedTestPayload', () => {
    it('should create verifiable payload', () => {
      const secret = generateWebhookSecret();
      const { body, timestamp, signature } = createSignedTestPayload({ event: 'test' }, secret);
      expect(validateSignature(signature, timestamp, body, secret).valid).toBe(true);
    });

    it('should serialize as JSON', () => {
      const secret = generateWebhookSecret();
      const { body } = createSignedTestPayload({ key: 'val' }, secret);
      expect(JSON.parse(body)).toEqual({ key: 'val' });
    });
  });
});

// ============================================
// 2. VMI -> Sales Order Creation
// ============================================
describe('VMI Sales Order Creation', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    setTestDb(drizzle(testSqlite, { schema }));

    for (const table of REQUIRED_TABLES) {
      try { testSqlite.exec(generateCreateTableSql(table)); } catch { /* skip */ }
    }

    testSqlite.exec("INSERT OR IGNORE INTO users (id, name, email, password, role, is_active) VALUES (1, 'Sales', 'sales@test.com', 'hash', 'sales', 1)");
    testSqlite.exec(`
      INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_active, on_hand, on_hand_cost, created_at, updated_at) VALUES
        (30, 'FG-VMI-001', 'VMI A', 'VMI A', 'finished_goods', 'products', 'box', 1, 200, 10000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        (31, 'FG-VMI-002', 'VMI B', 'VMI B', 'finished_goods', 'products', 'bottle', 1, 100, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  });

  afterEach(() => {
    if (testSqlite) testSqlite.close();
    vi.clearAllMocks();
  });

  it('should create SO with confirmed status', async () => {
    const r = await createSalesOrderFromVmi({
      vmiSalesOrderId: 1001, customerName: 'Hospital A', orderDate: '2025-01-15',
      totalAmount: 25000, lines: [{ itemId: 30, quantity: 50, unit: 'box', unitPrice: 500 }], userId: 1,
    });
    expect(r.soNumber).toMatch(/^SO-/);

    const so = testSqlite.prepare('SELECT status, source, vmi_sales_order_id FROM sales_orders WHERE id = ?').get(r.orderId) as any;
    expect(so.status).toBe('confirmed');
    expect(so.source).toBe('vmi');
    expect(so.vmi_sales_order_id).toBe(1001);
  });

  it('should create with multiple lines', async () => {
    const r = await createSalesOrderFromVmi({
      vmiSalesOrderId: 1002, customerName: 'Hospital B', orderDate: '2025-01-20',
      totalAmount: 35000, lines: [
        { itemId: 30, quantity: 30, unit: 'box', unitPrice: 500 },
        { itemId: 31, quantity: 20, unit: 'bottle', unitPrice: 1000 },
      ], userId: 1,
    });
    expect(testSqlite.prepare('SELECT count(*) as c FROM sales_order_lines WHERE so_id = ?').get(r.orderId) as any).toEqual({ c: 2 });
  });

  it('should calculate correct total', async () => {
    const r = await createSalesOrderFromVmi({
      vmiSalesOrderId: 1003, customerName: 'Hospital C', orderDate: '2025-01-25',
      totalAmount: 0, lines: [
        { itemId: 30, quantity: 10, unit: 'box', unitPrice: 500 },
        { itemId: 31, quantity: 5, unit: 'bottle', unitPrice: 800 },
      ], userId: 1,
    });
    expect((testSqlite.prepare('SELECT total_amount FROM sales_orders WHERE id = ?').get(r.orderId) as any).total_amount).toBe(9000);
  });

  it('should generate unique SO numbers', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, (_, i) => createSalesOrderFromVmi({
        vmiSalesOrderId: 2000 + i, customerName: 'Hosp ' + i, orderDate: '2025-01-15',
        totalAmount: 5000, lines: [{ itemId: 30, quantity: 10, unit: 'box', unitPrice: 500 }], userId: 1,
      }))
    );
    expect(new Set(results.map(r => r.soNumber)).size).toBe(3);
  });

  it('should store notes', async () => {
    const r = await createSalesOrderFromVmi({
      vmiSalesOrderId: 3001, customerName: 'Hospital D', orderDate: '2025-01-15',
      totalAmount: 5000, lines: [{ itemId: 30, quantity: 10, unit: 'box', unitPrice: 500 }],
      userId: 1, notes: 'Urgent delivery',
    });
    expect((testSqlite.prepare('SELECT notes FROM sales_orders WHERE id = ?').get(r.orderId) as any).notes).toBe('Urgent delivery');
  });
});

// ============================================
// 3. VmiPortalService Construction
// ============================================
describe('VmiPortalService Construction', () => {
  it('should construct with config', async () => {
    const { VmiPortalService } = await import('@/lib/services/vmi-portal.service');
    const svc = new VmiPortalService({ vendorId: 1, apiKeyEncrypted: 'key123', baseUrl: 'https://example.com/api' });
    expect(svc).toBeDefined();
  });

  it('should construct from vendor config', async () => {
    const { VmiPortalService } = await import('@/lib/services/vmi-portal.service');
    const svc = VmiPortalService.fromConfig({ vendorId: 1, apiKeyEncrypted: 'key', baseUrl: 'https://x.com' } as any);
    expect(svc).toBeDefined();
  });
});
