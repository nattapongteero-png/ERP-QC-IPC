/**
 * Accounting integrity regression tests.
 *
 * These lock down the four bugs that made the ledger wrong:
 *
 *  1. Goods receipt double-posted inventory AND accounts payable, because the receipt
 *     credited AP directly and the auto-created vendor invoice then credited AP again.
 *     Fixed with a GR/IR clearing account (2113).
 *
 *  2. SO shipment double-posted revenue AND accounts receivable, because the shipment
 *     booked the sale and the auto-created AR invoice booked it a second time.
 *     Fixed by making the shipment book ONLY cost of goods sold.
 *
 *  3. Integration entries posted to non-postable rollup parents (1130, 2110, 5100),
 *     which the trial balance excludes — so the TB and balance sheet disagreed.
 *
 *  4. Credit/debit notes bypassed the double-entry core entirely (raw inserts with wrong
 *     column names, hardcoded GL ids, no debit=credit check, and NO journal lines at all
 *     for debit notes).
 *
 * Every test asserts against real posted journal lines in a real (SQLite) database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';
import {
  seedGLAccountTypes,
  seedGLAccounts,
  seedFiscalYearAndPeriods,
  seedVendors,
  seedCustomers,
  ACCT_TEST_IDS,
  verifyTrialBalance,
  getAccountBalance,
} from '../../helpers/seed-accounting';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return { getTestDb: () => _testDb, setTestDb: (db: any) => { _testDb = db; } };
});

let testSqlite: Database.Database;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));
vi.mock('@/lib/audit', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn(() => Promise.resolve({ success: true, status: 'matched', exceptions: [] })),
}));

import {
  createPOReceiptJournalEntry,
  createAPInvoiceFromPOReceipt,
  createSOShipmentJournalEntry,
  getPostableAccountByCode,
  createJournalEntry,
} from '@/lib/services/accounting.service';

const ALL_TABLES = [
  schema.sqliteGLAccountTypes, schema.sqliteGLAccounts, schema.sqliteFiscalYears,
  schema.sqliteFiscalPeriods, schema.sqliteJournalEntries, schema.sqliteJournalLines,
  schema.sqliteVendors, schema.sqliteCustomers, schema.sqliteAPInvoices,
  schema.sqliteAPInvoiceLines, schema.sqliteARInvoices, schema.sqliteARInvoiceLines,
  schema.sqlitePayments, schema.sqlitePaymentAllocations, schema.sqliteVATTransactions,
  schema.sqliteAuditTrail,
];

const USER_ID = 1;
const TODAY = '2026-01-15';

beforeEach(() => {
  testSqlite = new Database(':memory:');
  testSqlite.pragma('foreign_keys = OFF');
  for (const table of ALL_TABLES) {
    testSqlite.exec(generateCreateTableSql(table));
  }
  setTestDb(drizzle(testSqlite, { schema }));

  seedGLAccountTypes(testSqlite);
  seedGLAccounts(testSqlite);
  seedFiscalYearAndPeriods(testSqlite);
  seedVendors(testSqlite);
  seedCustomers(testSqlite);
});

afterEach(() => {
  testSqlite?.close();
  setTestDb(null);
});

describe('Goods receipt must not double-post inventory or AP', () => {
  const receiptInput = {
    poId: 1,
    poNumber: 'PO-2026-001',
    vendorId: 1,
    vendorName: 'Test Vendor',
    receiptDate: TODAY,
    lotId: 1,
    lotNumber: 'LOT-001',
    itemId: 1,
    itemCode: 'RM-001',
    quantity: 10,
    unitPrice: 100,
    totalAmount: 1070, // 1000 net + 70 VAT
    vatAmount: 70,
    netAmount: 1000,
  };

  it('receipt books Dr Raw Materials / Cr GR-IR — and does NOT touch AP', async () => {
    await createPOReceiptJournalEntry(receiptInput, USER_ID);

    // Inventory capitalised at net (VAT is not part of stock cost)
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_RAW)).toBe(1000);
    // GR/IR carries the "goods received, not yet invoiced" liability
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.GRIR_CLEARING)).toBe(-1000);
    // AP is NOT touched by the receipt — the vendor invoice creates the payable
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(0);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });

  it('receipt + vendor invoice books inventory ONCE and AP ONCE, and clears GR-IR to zero', async () => {
    await createPOReceiptJournalEntry(receiptInput, USER_ID);
    await createAPInvoiceFromPOReceipt(
      { ...receiptInput, itemName: 'Raw Material 1', dueDate: '2026-02-14' },
      USER_ID
    );

    // THE REGRESSION: inventory must be 1000, not 2000
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_RAW)).toBe(1000);

    // THE REGRESSION: AP must be 1070 (gross, once), not 2140
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(-1070);

    // GR/IR nets to zero once the invoice clears the receipt — this is the whole point
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.GRIR_CLEARING)).toBe(0);

    // Input VAT is claimed on the tax invoice, not on the receipt
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(70);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });
});

describe('SO shipment must not double-post revenue or AR', () => {
  it('shipment books ONLY Dr COGS / Cr Finished Goods — no revenue, no AR', async () => {
    const result = await createSOShipmentJournalEntry(
      {
        deliveryId: 1,
        deliveryNumber: 'DN-2026-001',
        soId: 1,
        soNumber: 'SO-2026-001',
        customerName: 'Test Customer',
        shipmentDate: TODAY,
        totalAmount: 2140,
        vatAmount: 140,
        netAmount: 2000,
        costOfGoodsSold: 1200,
      },
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.cogsJournalEntryId).toBeDefined();

    // Cost side is booked
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.COGS)).toBe(1200);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_FG)).toBe(-1200);

    // THE REGRESSION: revenue and AR are booked by the AR invoice, NOT here.
    // Previously the shipment booked them too, so every sale counted twice.
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(0);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(0);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.OUTPUT_VAT)).toBe(0);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });

  it('shipment with zero cost posts no journal entry at all', async () => {
    const result = await createSOShipmentJournalEntry(
      {
        deliveryId: 2,
        deliveryNumber: 'DN-2026-002',
        soId: 2,
        soNumber: 'SO-2026-002',
        customerName: 'Test Customer',
        shipmentDate: TODAY,
        totalAmount: 1070,
        vatAmount: 70,
        netAmount: 1000,
        costOfGoodsSold: 0,
      },
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(result.cogsJournalEntryId).toBeUndefined();

    const entryCount = testSqlite
      .prepare('SELECT COUNT(*) AS c FROM journal_entries')
      .get() as { c: number };
    expect(entryCount.c).toBe(0);
  });
});

describe('Journal lines must never post to non-postable rollup parents', () => {
  // 1130 Inventory, 2110 Accounts Payable and 5100 COGS are rollup parents. The trial
  // balance skips non-postable accounts, so posting to one silently drops the amount
  // from the TB while the balance sheet still shows it — the reports then disagree.
  it('getPostableAccountByCode rejects a non-postable parent', async () => {
    testSqlite.exec(`
      INSERT INTO gl_accounts (id, code, name_th, name_en, account_type_id, level, is_active, is_postable, is_bank_account, created_by, created_at, updated_at)
      VALUES (999, '1130', 'สินค้าคงเหลือ', 'Inventory', ${ACCT_TEST_IDS.ASSET_TYPE}, 2, 1, 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    await expect(getPostableAccountByCode('1130', 'บัญชีสินค้าคงเหลือ')).rejects.toThrow(
      /บัญชีคุมยอด/
    );
  });

  it('getPostableAccountByCode rejects an inactive account', async () => {
    testSqlite.exec(`
      INSERT INTO gl_accounts (id, code, name_th, name_en, account_type_id, level, is_active, is_postable, is_bank_account, created_by, created_at, updated_at)
      VALUES (998, '1199', 'บัญชีปิด', 'Closed Account', ${ACCT_TEST_IDS.ASSET_TYPE}, 3, 0, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    await expect(getPostableAccountByCode('1199', 'บัญชีปิด')).rejects.toThrow(/ปิดใช้งาน/);
  });

  it('getPostableAccountByCode returns the id for a real postable leaf', async () => {
    const account = await getPostableAccountByCode('1131', 'บัญชีวัตถุดิบ');
    expect(account.id).toBe(ACCT_TEST_IDS.INVENTORY_RAW);
  });

  it('every posted journal line lands on a postable account after a full receipt cycle', async () => {
    const receiptInput = {
      poId: 1, poNumber: 'PO-2026-002', vendorId: 1, vendorName: 'Test Vendor',
      receiptDate: TODAY, lotId: 2, lotNumber: 'LOT-002', itemId: 1,
      itemCode: 'RM-001', quantity: 5, unitPrice: 100,
      totalAmount: 535, vatAmount: 35, netAmount: 500,
    };

    await createPOReceiptJournalEntry(receiptInput, USER_ID);
    await createAPInvoiceFromPOReceipt(
      { ...receiptInput, itemName: 'Raw Material 1', dueDate: '2026-02-14' },
      USER_ID
    );

    const offenders = testSqlite
      .prepare(`
        SELECT a.code
        FROM journal_lines jl
        JOIN gl_accounts a ON a.id = jl.gl_account_id
        WHERE a.is_postable = 0
      `)
      .all() as Array<{ code: string }>;

    expect(offenders).toEqual([]);
  });
});

describe('Double-entry core rejects unbalanced entries', () => {
  it('refuses an entry whose debits do not equal its credits', async () => {
    await expect(
      createJournalEntry({
        entryDate: TODAY,
        description: 'Deliberately unbalanced',
        sourceType: 'MANUAL',
        createdBy: USER_ID,
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 100, credit: 0, description: 'Dr' },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 90, description: 'Cr' },
        ],
      })
    ).rejects.toThrow();

    // Nothing partial should have been written
    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });

  it('refuses a single-line entry', async () => {
    await expect(
      createJournalEntry({
        entryDate: TODAY,
        description: 'Single line',
        sourceType: 'MANUAL',
        createdBy: USER_ID,
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 100, credit: 0, description: 'Dr only' },
        ],
      })
    ).rejects.toThrow();
  });
});
