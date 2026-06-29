/**
 * Unit tests — Metaherb PO dual-approval merge logic + po-submit webhook gating.
 *
 * Covers applyMetaherbPoDecision (the merge rule: Metaherb approves first, then
 * ERP owner finalises) and the notify/build helpers' Metaherb-only gating.
 *
 * Real in-memory better-sqlite3 built from the Drizzle schema; `@/lib/db`
 * mocked so the real db-helper runs against this DB. fetch + SSO config mocked.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableName, getTableColumns, eq } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '@/lib/db/schema';

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => testDb,
  getSqliteDb: () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

const getMetaherbSsoConfigMock = vi.fn();
vi.mock('@/lib/services/metaherb-sso.service', async () => {
  // Keep the real derive helpers; only stub the config getter.
  const actual = await vi.importActual<any>('@/lib/services/metaherb-sso.service');
  return {
    ...actual,
    getMetaherbSsoConfig: () => getMetaherbSsoConfigMock(),
  };
});

import { applyMetaherbPoDecision } from '@/lib/services/metaherb-po-approval.service';
import {
  notifyMetaherbPoSubmit,
  notifyMetaherbPoOwnerDecision,
  isMetaherbVendorCode,
} from '@/lib/services/metaherb-po-webhook.service';

function generateCreateTableSql(table: SQLiteTable): string {
  const tableName = getTableName(table);
  const columns = getTableColumns(table);
  const defs: string[] = [];
  for (const [, column] of Object.entries(columns)) {
    const col = column as any;
    let def = `"${col.name}" `;
    switch (col.dataType) {
      case 'number':
      case 'boolean':
        def += 'INTEGER';
        break;
      default:
        def += 'TEXT';
    }
    if (col.primary) {
      def += ' PRIMARY KEY';
      if (col.autoIncrement) def += ' AUTOINCREMENT';
    }
    if (col.notNull && !col.primary) def += ' NOT NULL';
    if (col.hasDefault && col.default !== undefined) {
      if (typeof col.default === 'number') def += ` DEFAULT ${col.default}`;
      else if (typeof col.default === 'string')
        def += col.default === 'CURRENT_TIMESTAMP' ? ' DEFAULT CURRENT_TIMESTAMP' : ` DEFAULT '${col.default}'`;
    }
    defs.push(def);
  }
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (${defs.join(', ')})`;
}

let metaherbVendorId = 0;
let acmeVendorId = 0;
let itemId = 0;

async function seedVendors() {
  const m = await testDb.insert(schema.sqliteVendors).values({
    code: 'METAHERB', name: 'METAHERB Store', isApproved: true, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  metaherbVendorId = m.lastInsertRowid as number;
  const a = await testDb.insert(schema.sqliteVendors).values({
    code: 'ACME', name: 'Acme', isApproved: true, isActive: true,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  acmeVendorId = a.lastInsertRowid as number;
  const it = await testDb.insert(schema.sqliteItems).values({
    code: 'IT-1', nameTh: 'สินค้า', type: 'raw_material', primaryUnit: 'pcs',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  } as any);
  itemId = it.lastInsertRowid as number;
}

let poCounter = 0;
async function insertPo(
  vendorId: number,
  status: string,
  metaherbApproval: string | null,
  erpOwnerApproval: string | null = null,
): Promise<number> {
  poCounter++;
  const res = await testDb.insert(schema.sqlitePurchaseOrders).values({
    poNumber: `PO-${poCounter}`,
    vendorId,
    status,
    totalAmount: 200,
    metaherbApproval: metaherbApproval ?? undefined,
    erpOwnerApproval: erpOwnerApproval ?? undefined,
    orderDate: '2026-06-28',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  const poId = res.lastInsertRowid as number;
  await testDb.insert(schema.sqlitePurchaseOrderLines).values({
    poId, itemId, quantity: 2, unit: 'pcs', unitPrice: 100, totalPrice: 200,
    createdAt: new Date().toISOString(),
  } as any);
  return poId;
}

async function getPo(poId: number) {
  const rows = await testDb.select().from(schema.sqlitePurchaseOrders)
    .where(eq(schema.sqlitePurchaseOrders.id, poId));
  return rows[0];
}

async function getDeliveries(poId: number) {
  return testDb.select().from(schema.sqliteMetaherbPoWebhookDeliveries)
    .where(eq(schema.sqliteMetaherbPoWebhookDeliveries.poId, poId));
}

beforeAll(() => {
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite);
  for (const t of [
    schema.sqliteVendors,
    schema.sqliteItems,
    schema.sqlitePurchaseOrders,
    schema.sqlitePurchaseOrderLines,
    schema.sqliteMetaherbPoWebhookDeliveries,
  ]) {
    sqlite.exec(generateCreateTableSql(t as SQLiteTable));
  }
});

afterAll(() => sqlite?.close());

beforeEach(async () => {
  vi.clearAllMocks();
  sqlite.exec('DELETE FROM purchase_order_lines');
  sqlite.exec('DELETE FROM purchase_orders');
  sqlite.exec('DELETE FROM vendors');
  sqlite.exec('DELETE FROM items');
  sqlite.exec('DELETE FROM metaherb_po_webhook_deliveries');
  await seedVendors();
  getMetaherbSsoConfigMock.mockResolvedValue({
    ssoSecret: 'b'.repeat(64),
    baseUrl: 'https://api.x',
    companyKey: 'uat',
    callbackUrl: 'https://api.x/api/sso/erp/callback/uat',
    prStatusUrl: 'https://api.x/api/erp/pr-status/uat',
    poSubmitUrl: 'https://api.x/api/erp/po-submit/uat',
    poOwnerDecisionUrl: 'https://api.x/api/erp/po-owner-decision/uat',
    factoryName: 'โรงงานทดสอบ',
    source: {},
  });
});

describe('isMetaherbVendorCode', () => {
  it('matches METAHERB case-insensitively, rejects others/null', () => {
    expect(isMetaherbVendorCode('METAHERB')).toBe(true);
    expect(isMetaherbVendorCode('metaherb')).toBe(true);
    expect(isMetaherbVendorCode(' Metaherb ')).toBe(true);
    expect(isMetaherbVendorCode('ACME')).toBe(false);
    expect(isMetaherbVendorCode(null)).toBe(false);
  });
});

describe('applyMetaherbPoDecision (parallel)', () => {
  it('Metaherb approves while owner still pending → keeps pending_approval', async () => {
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending', 'pending');
    const res = await applyMetaherbPoDecision(poId, 'approved');
    expect(res.ok).toBe(true);
    const po = await getPo(poId);
    expect(po.metaherbApproval).toBe('approved');
    expect(po.status).toBe('pending_approval'); // owner hasn't approved yet
  });

  it('Metaherb approves AND owner already approved → PO approved', async () => {
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending', 'approved');
    const res = await applyMetaherbPoDecision(poId, 'approved');
    expect(res.ok).toBe(true);
    const po = await getPo(poId);
    expect(po.metaherbApproval).toBe('approved');
    expect(po.status).toBe('approved'); // both sides in
  });

  it('rejected → metaherbApproval=rejected AND status=rejected', async () => {
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending', 'approved');
    const res = await applyMetaherbPoDecision(poId, 'rejected');
    expect(res.ok).toBe(true);
    const po = await getPo(poId);
    expect(po.metaherbApproval).toBe('rejected');
    expect(po.status).toBe('rejected');
  });

  it('is idempotent on repeat decision', async () => {
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'approved', 'pending');
    const res = await applyMetaherbPoDecision(poId, 'approved');
    expect(res.ok && res.status).toBe('idempotent');
  });

  it('rejects a non-Metaherb PO', async () => {
    const poId = await insertPo(acmeVendorId, 'pending_approval', null);
    const res = await applyMetaherbPoDecision(poId, 'approved');
    expect(res).toMatchObject({ ok: false, error: 'NOT_METAHERB_PO' });
  });

  it('404 on missing PO', async () => {
    const res = await applyMetaherbPoDecision(999999, 'approved');
    expect(res).toMatchObject({ ok: false, error: 'PO_NOT_FOUND' });
  });

  it('cannot reject a PO already past approval', async () => {
    const poId = await insertPo(metaherbVendorId, 'sent', 'approved');
    const res = await applyMetaherbPoDecision(poId, 'rejected');
    expect(res).toMatchObject({ ok: false, error: 'NOT_PENDING' });
  });
});

describe('notifyMetaherbPoSubmit', () => {
  it('skips non-Metaherb PO (no fetch, no delivery row)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(acmeVendorId, 'pending_approval', null);
    await notifyMetaherbPoSubmit(poId);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDeliveries(poId)).toHaveLength(0);
  });

  it('sends + records a processed delivery for a Metaherb PO on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending');
    await notifyMetaherbPoSubmit(poId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.x/api/erp/po-submit/uat');
    expect(opts.headers['X-Webhook-Signature']).toBeTruthy();
    const body = JSON.parse(opts.body);
    expect(body.erpPOID).toBe(poId);
    expect(body.factory).toBe('โรงงานทดสอบ');
    expect(body.supplier).toBe('METAHERB Store');
    expect(body.items).toHaveLength(1);
    const deliveries = await getDeliveries(poId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].status).toBe('processed');
  });

  it('leaves a pending delivery (for retry) on 5xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending');
    await notifyMetaherbPoSubmit(poId);
    const deliveries = await getDeliveries(poId);
    expect(deliveries[0].status).toBe('pending');
    expect(deliveries[0].nextRetryAt).toBeTruthy();
  });
});

describe('notifyMetaherbPoOwnerDecision', () => {
  it('skips non-Metaherb PO', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(acmeVendorId, 'pending_approval', null);
    await notifyMetaherbPoOwnerDecision(poId, 'approved', 'PO-X');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDeliveries(poId)).toHaveLength(0);
  });

  it('POSTs owner decision to the po-owner-decision URL with reason on reject', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(metaherbVendorId, 'rejected', 'pending', 'rejected');
    await notifyMetaherbPoOwnerDecision(poId, 'rejected', 'PO-OWNER-1', 'ราคาสูงเกินไป');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.x/api/erp/po-owner-decision/uat');
    expect(opts.headers['X-Webhook-Signature']).toBeTruthy();
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      erpPOID: poId,
      decision: 'rejected',
      poNumber: 'PO-OWNER-1',
      reason: 'ราคาสูงเกินไป',
    });
    const deliveries = await getDeliveries(poId);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].eventType).toBe('po_owner_decision');
    expect(deliveries[0].status).toBe('processed');
  });

  it('omits reason on approve (reason only meaningful on reject)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    const poId = await insertPo(metaherbVendorId, 'pending_approval', 'pending', 'approved');
    await notifyMetaherbPoOwnerDecision(poId, 'approved', 'PO-OWNER-2');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ erpPOID: poId, decision: 'approved', poNumber: 'PO-OWNER-2' });
    expect('reason' in body).toBe(false);
  });
});
