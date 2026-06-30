/**
 * Unit tests — PR→PO conversion vendor logic.
 *
 * Verifies the Metaherb auto-vendor rule on convertPRToPO:
 *  - a Metaherb-originated PR forces the METAHERB vendor (created on first use),
 *  - a second Metaherb conversion reuses the same vendor row (idempotent),
 *  - a vendor created by hand under a different code but the same tax_id is reused,
 *  - a non-Metaherb PR keeps the user-selected vendor,
 *  - a non-Metaherb PR with no vendor is rejected.
 *
 * Uses the repo's canonical test-DB setup: in-memory better-sqlite3, CREATE TABLE
 * generated from the Drizzle schema, `@/lib/db` mocked so the real db-helper runs
 * against this SQLite db. The Metaherb webhook is stubbed (fired fire-and-forget).
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

// db-helper.isSqlite() reads from '@/lib/db', mocked above → returns true.
// The Metaherb webhook is fire-and-forget; stub it so it never touches network.
vi.mock('@/lib/services/metaherb-pr-webhook.service', async () => {
  const actual = await vi.importActual<any>('@/lib/services/metaherb-pr-webhook.service');
  return {
    ...actual,
    notifyMetaherbPrStatus: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/services/approval-workflow.service', () => ({
  submitForApproval: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));

import { convertPRToPO } from '@/lib/services/purchase-requisition.service';

// --- CREATE TABLE generator (mirrors metaherb-pr-webhook.service.test.ts) ---
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

const METAHERB_TAX_ID = '0105565148242';

// A real item the PR lines reference. purchase_order_lines.item_id is NOT NULL
// with an FK to items, so converted PR lines must carry a resolvable itemId
// (Metaherb now sends one). We seed one and reuse it across the suite.
let seededItemId = 0;
async function seedItem(): Promise<number> {
  const res = await testDb.insert(schema.sqliteItems).values({
    code: 'TEST-ITEM-1',
    nameTh: 'สินค้าทดสอบ',
    type: 'raw_material',
    primaryUnit: 'pcs',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  return res.lastInsertRowid as number;
}

let prCounter = 0;
async function insertApprovedPr(
  externalSource: string | null,
  opts?: { vendorId?: number; paymentTerms?: string }
): Promise<number> {
  prCounter++;
  const res = await testDb.insert(schema.sqlitePurchaseRequisitions).values({
    prNumber: `PR-${prCounter}`,
    requesterId: 1,
    status: 'approved',
    externalSource: externalSource ?? undefined,
    vendorId: opts?.vendorId,
    paymentTerms: opts?.paymentTerms,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
  const prId = res.lastInsertRowid as number;
  // One approved line so there is something to convert.
  await testDb.insert(schema.sqlitePurchaseRequisitionLines).values({
    prId,
    lineNumber: 1,
    itemId: seededItemId,
    description: 'Sample item',
    quantity: 2,
    unit: 'pcs',
    estimatedPrice: 100,
    lineTotal: 200,
    externalLineRef: 'PRL-4821',
    status: 'approved',
  } as any);
  return prId;
}

async function getPoLines(poId: number) {
  return testDb
    .select()
    .from(schema.sqlitePurchaseOrderLines)
    .where(eq(schema.sqlitePurchaseOrderLines.poId, poId));
}

async function getVendors() {
  return testDb.select().from(schema.sqliteVendors);
}

async function getPO(poId: number) {
  const rows = await testDb
    .select()
    .from(schema.sqlitePurchaseOrders)
    .where(eq(schema.sqlitePurchaseOrders.id, poId));
  return rows[0];
}

beforeAll(() => {
  sqlite = new Database(':memory:');
  testDb = drizzle(sqlite);
  for (const t of [
    schema.sqliteVendors,
    schema.sqlitePurchaseRequisitions,
    schema.sqlitePurchaseRequisitionLines,
    schema.sqlitePurchaseOrders,
    schema.sqlitePurchaseOrderLines,
    schema.sqliteItems,
  ]) {
    sqlite.exec(generateCreateTableSql(t as SQLiteTable));
  }
});

afterAll(() => {
  sqlite?.close();
});

beforeEach(async () => {
  vi.clearAllMocks();
  sqlite.exec('DELETE FROM vendors');
  sqlite.exec('DELETE FROM purchase_requisitions');
  sqlite.exec('DELETE FROM purchase_requisition_lines');
  sqlite.exec('DELETE FROM purchase_orders');
  sqlite.exec('DELETE FROM purchase_order_lines');
  sqlite.exec('DELETE FROM items');
  seededItemId = await seedItem();
});

describe('convertPRToPO — Metaherb auto-vendor', () => {
  it('creates the METAHERB vendor and uses it when none exists yet', async () => {
    const prId = await insertApprovedPr('metaherb');

    const res = await convertPRToPO({ prId }, 1);

    const vendors = await getVendors();
    expect(vendors).toHaveLength(1);
    expect(vendors[0].code).toBe('METAHERB');
    expect(vendors[0].taxId).toBe(METAHERB_TAX_ID);
    expect(vendors[0].isApproved).toBeTruthy();

    const po = await getPO(res.poId);
    expect(po.vendorId).toBe(vendors[0].id);
  });

  it('reuses the same METAHERB vendor on a second conversion (idempotent)', async () => {
    const pr1 = await insertApprovedPr('metaherb');
    await convertPRToPO({ prId: pr1 }, 1);
    const pr2 = await insertApprovedPr('METAHERB_WEB'); // case-insensitive prefix

    const res2 = await convertPRToPO({ prId: pr2 }, 1);

    const vendors = await getVendors();
    expect(vendors).toHaveLength(1); // no duplicate
    const po2 = await getPO(res2.poId);
    expect(po2.vendorId).toBe(vendors[0].id);
  });

  it('reuses a hand-created vendor that shares the tax_id (different code)', async () => {
    // Vendor typed by hand under a different code but same tax id.
    const ins = await testDb.insert(schema.sqliteVendors).values({
      code: 'METAHER',
      name: 'เมตาเฮิร์บ',
      taxId: METAHERB_TAX_ID,
      isApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    const existingId = ins.lastInsertRowid as number;

    const prId = await insertApprovedPr('metaherb');
    const res = await convertPRToPO({ prId }, 1);

    const vendors = await getVendors();
    expect(vendors).toHaveLength(1); // reused, not duplicated
    const po = await getPO(res.poId);
    expect(po.vendorId).toBe(existingId);
  });

  it('keeps the user-selected vendor for a non-Metaherb PR', async () => {
    const ins = await testDb.insert(schema.sqliteVendors).values({
      code: 'ACME',
      name: 'Acme Co',
      isApproved: true,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    const acmeId = ins.lastInsertRowid as number;

    const prId = await insertApprovedPr(null);
    const res = await convertPRToPO({ prId, vendorId: acmeId }, 1);

    const po = await getPO(res.poId);
    expect(po.vendorId).toBe(acmeId);
    // No METAHERB vendor was created.
    const vendors = await getVendors();
    expect(vendors.map((v) => v.code)).not.toContain('METAHERB');
  });

  it('rejects a non-Metaherb PR with no vendor selected', async () => {
    const prId = await insertApprovedPr(null);
    await expect(convertPRToPO({ prId }, 1)).rejects.toThrow('VENDOR_REQUIRED');
  });

  it('uses the vendor pre-selected on the PR when none is passed at convert', async () => {
    const ins = await testDb.insert(schema.sqliteVendors).values({
      code: 'PREF', name: 'Preferred Co', isApproved: true, isActive: true,
      paymentTerms: 'Net 30',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any);
    const prefId = ins.lastInsertRowid as number;

    // PR carries the vendor + payment terms; convert is called WITHOUT a vendor.
    const prId = await insertApprovedPr(null, { vendorId: prefId, paymentTerms: 'Net 45' });
    const res = await convertPRToPO({ prId }, 1);

    const po = await getPO(res.poId);
    expect(po.vendorId).toBe(prefId);          // pulled from the PR, no re-pick
    expect(po.paymentTerms).toBe('Net 45');    // PR's terms win over vendor default
  });

  it('lets an explicit convert-time vendor override the PR vendor', async () => {
    const a = await testDb.insert(schema.sqliteVendors).values({
      code: 'PRV', name: 'PR Vendor', isApproved: true, isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any);
    const prVendorId = a.lastInsertRowid as number;
    const b = await testDb.insert(schema.sqliteVendors).values({
      code: 'OVR', name: 'Override Vendor', isApproved: true, isActive: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as any);
    const overrideId = b.lastInsertRowid as number;

    const prId = await insertApprovedPr(null, { vendorId: prVendorId });
    const res = await convertPRToPO({ prId, vendorId: overrideId }, 1);

    const po = await getPO(res.poId);
    expect(po.vendorId).toBe(overrideId);
  });

  it('copies externalLineRef from the PR line to the PO line on convert', async () => {
    const prId = await insertApprovedPr('metaherb');
    const res = await convertPRToPO({ prId }, 1);
    const poLines = await getPoLines(res.poId);
    expect(poLines).toHaveLength(1);
    expect(poLines[0].externalLineRef).toBe('PRL-4821');
  });
});
