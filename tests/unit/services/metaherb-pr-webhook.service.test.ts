/**
 * Unit tests — Metaherb PR-status OUTBOUND webhook service.
 *
 * Covers: body builder + signature, skip for non-Metaherb PRs, successful send
 * + delivery row, retry scheduling on 5xx, terminal on 403/401, config-missing
 * handling, never-throws guarantee, and the retry sweeper.
 *
 * Uses the repo's canonical test DB setup: in-memory better-sqlite3, CREATE
 * TABLE generated from the Drizzle schema, `@/lib/db` mocked. `global.fetch`
 * and the SSO config getter are mocked per-test.
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

// Mock the SSO config getter — each test sets the resolved value.
const getMetaherbSsoConfigMock = vi.fn();
vi.mock('@/lib/services/metaherb-sso.service', () => ({
  getMetaherbSsoConfig: () => getMetaherbSsoConfigMock(),
}));

import {
  buildMetaherbPrStatusBody,
  notifyMetaherbPrStatus,
  retryDueMetaherbPrWebhooks,
} from '@/lib/services/metaherb-pr-webhook.service';
import { computeSignature } from '@/lib/services/vmi-webhook-crypto';

// --- CREATE TABLE generator (mirrors vmi-webhook.service.test.ts) ---
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

const SECRET = 'b'.repeat(64);
const URL_TARGET = 'https://api.pomdevth.site/api/erp/pr-status/arjaro';

// Insert a PR row directly; returns its id.
async function insertPr(externalSource: string | null): Promise<number> {
  const res = await testDb.insert(schema.sqlitePurchaseRequisitions).values({
    prNumber: `PR-${Math.floor(performance.now() * 1000) % 1_000_000}`,
    requesterId: 1,
    status: 'approved',
    externalSource: externalSource ?? undefined,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  return res.lastInsertRowid as number;
}

async function getDeliveries(prId: number) {
  return testDb
    .select()
    .from(schema.sqliteMetaherbPrWebhookDeliveries)
    .where(eq(schema.sqliteMetaherbPrWebhookDeliveries.prId, prId));
}

beforeAll(() => {
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite);
  for (const t of [
    schema.sqliteUsers,
    schema.sqliteHREmployees,
    schema.sqliteHROrgUnits,
    schema.sqlitePurchaseRequisitions,
    schema.sqliteMetaherbPrWebhookDeliveries,
  ]) {
    sqlite.exec(generateCreateTableSql(t as SQLiteTable));
  }
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: fully configured.
  getMetaherbSsoConfigMock.mockResolvedValue({
    ssoSecret: SECRET,
    callbackUrl: null,
    prStatusUrl: URL_TARGET,
    source: { secret: 'db', callback: 'none', prStatus: 'db' },
  });
});

describe('buildMetaherbPrStatusBody', () => {
  it('omits poNumber for non-converted statuses', () => {
    const b = buildMetaherbPrStatusBody(123, 'approved');
    expect(b).toEqual({ erpPRID: 123, status: 'approved' });
    expect('poNumber' in b).toBe(false);
  });

  it('includes poNumber only for converted', () => {
    const b = buildMetaherbPrStatusBody(123, 'converted', 'PO2026-0001');
    expect(b).toEqual({ erpPRID: 123, status: 'converted', poNumber: 'PO2026-0001' });
  });

  it('drops a stray poNumber on a non-converted status', () => {
    // poNumber passed but status is cancelled → must not appear (refine guard).
    const b = buildMetaherbPrStatusBody(123, 'cancelled', 'PO-OOPS');
    expect('poNumber' in b).toBe(false);
  });

  it('never includes companyKey', () => {
    const b = buildMetaherbPrStatusBody(1, 'approved') as Record<string, unknown>;
    expect('companyKey' in b).toBe(false);
  });
});

describe('notifyMetaherbPrStatus', () => {
  it('skips silently for a non-Metaherb PR (no fetch, no delivery row)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr(null);

    await notifyMetaherbPrStatus(prId, 'approved');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getDeliveries(prId)).toHaveLength(0);
  });

  it('sends a correctly-signed request for a Metaherb PR and records a processed delivery', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await notifyMetaherbPrStatus(prId, 'approved');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_TARGET);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    const ts = headers['X-Webhook-Timestamp'];
    const sig = headers['X-Webhook-Signature'];
    const rawBody = init.body as string;
    // Body shape
    expect(JSON.parse(rawBody)).toEqual({ erpPRID: prId, status: 'approved' });
    // Signature verifies against the spec formula
    expect(sig).toBe(computeSignature(ts, rawBody, SECRET));
    // ts is Unix seconds (10 digits-ish, not ms)
    expect(ts).toMatch(/^\d{9,10}$/);

    const rows = await getDeliveries(prId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('processed');
    expect(rows[0].httpStatus).toBe(200);
    expect(rows[0].nextRetryAt).toBeNull();
    expect(rows[0].attemptCount).toBe(1);
  });

  it('schedules a retry on a 5xx response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await notifyMetaherbPrStatus(prId, 'rejected');

    const rows = await getDeliveries(prId);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].attemptCount).toBe(1);
    expect(rows[0].httpStatus).toBe(503);
    expect(rows[0].nextRetryAt).not.toBeNull();
    expect(rows[0].lastError).toContain('503');
  });

  it('is terminal (no retry) on 403 cross-tenant', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await notifyMetaherbPrStatus(prId, 'cancelled');

    const rows = await getDeliveries(prId);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].nextRetryAt).toBeNull();
  });

  it('is terminal on 401 (bad/expired signature — our bug, retry pointless)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await notifyMetaherbPrStatus(prId, 'approved');

    const rows = await getDeliveries(prId);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].nextRetryAt).toBeNull();
  });

  it('records a failed delivery with config_missing when prStatusUrl is absent (no fetch)', async () => {
    getMetaherbSsoConfigMock.mockResolvedValue({
      ssoSecret: SECRET,
      callbackUrl: null,
      prStatusUrl: null,
      source: { secret: 'db', callback: 'none', prStatus: 'none' },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await notifyMetaherbPrStatus(prId, 'approved');

    expect(fetchMock).not.toHaveBeenCalled();
    const rows = await getDeliveries(prId);
    expect(rows[0].status).toBe('failed');
    expect(rows[0].lastError).toBe('config_missing');
  });

  it('never throws when fetch rejects, and leaves a pending row for the sweeper', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);
    const prId = await insertPr('metaherb');

    await expect(notifyMetaherbPrStatus(prId, 'approved')).resolves.toBeUndefined();

    const rows = await getDeliveries(prId);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].attemptCount).toBe(1);
    expect(rows[0].lastError).toContain('ECONNREFUSED');
  });
});

describe('retryDueMetaherbPrWebhooks', () => {
  it('re-sends a due pending delivery and flips it to processed', async () => {
    const prId = await insertPr('metaherb');
    // Seed a due pending delivery (nextRetryAt in the past, attemptCount 1).
    await testDb.insert(schema.sqliteMetaherbPrWebhookDeliveries).values({
      prId,
      deliveryId: 'due-1',
      eventType: 'approved',
      targetUrl: URL_TARGET,
      payload: JSON.stringify({ erpPRID: prId, status: 'approved' }),
      signature: 'x',
      timestamp: '1',
      status: 'pending',
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    } as any);
    // And a NOT-due one (future nextRetryAt).
    await testDb.insert(schema.sqliteMetaherbPrWebhookDeliveries).values({
      prId,
      deliveryId: 'future-1',
      eventType: 'approved',
      targetUrl: URL_TARGET,
      payload: JSON.stringify({ erpPRID: prId, status: 'approved' }),
      signature: 'x',
      timestamp: '1',
      status: 'pending',
      attemptCount: 1,
      nextRetryAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
    } as any);

    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await retryDueMetaherbPrWebhooks();

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the due one
    expect(summary.attempted).toBe(1);
    expect(summary.succeeded).toBe(1);

    const due = (await getDeliveries(prId)).find((d) => d.deliveryId === 'due-1');
    const future = (await getDeliveries(prId)).find((d) => d.deliveryId === 'future-1');
    expect(due?.status).toBe('processed');
    expect(due?.attemptCount).toBe(2);
    expect(future?.status).toBe('pending'); // untouched
  });

  it('terminates a delivery after the last retry attempt fails', async () => {
    const prId = await insertPr('metaherb');
    // attemptCount 3 already (MAX_ATTEMPTS=4) → next failure is terminal.
    await testDb.insert(schema.sqliteMetaherbPrWebhookDeliveries).values({
      prId,
      deliveryId: 'last-1',
      eventType: 'approved',
      targetUrl: URL_TARGET,
      payload: JSON.stringify({ erpPRID: prId, status: 'approved' }),
      signature: 'x',
      timestamp: '1',
      status: 'pending',
      attemptCount: 3,
      nextRetryAt: new Date(Date.now() - 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    } as any);

    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const summary = await retryDueMetaherbPrWebhooks();

    expect(summary.failed).toBe(1);
    const row = (await getDeliveries(prId)).find((d) => d.deliveryId === 'last-1');
    expect(row?.status).toBe('failed');
    expect(row?.attemptCount).toBe(4);
    expect(row?.nextRetryAt).toBeNull();
  });
});
