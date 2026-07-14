/**
 * Credit / Debit Note posting regression tests.
 *
 * postNote() used to bypass the double-entry core with raw inserts, and was broken in
 * four independent ways:
 *
 *   1. Wrong column names (`accountId`/`debitAmount`/`creditAmount`/`reference`) — the
 *      real columns are glAccountId/debit/credit, and journal_entries has no `reference`.
 *   2. Hardcoded GL account row ids (103/107/201/211) that are not the seeded accounts.
 *   3. NO journal lines emitted for debit notes at all — only the two credit branches
 *      were implemented, so a debit note posted a header with zero lines.
 *   4. Read/wrote an `ap_invoices.balance_due` / `ar_invoices.balance_due` column that
 *      does not exist anywhere in the schema.
 *
 * Existing unit tests missed all of this because they vi.mock the db-helper, so the wrong
 * column names "existed" on the fake table object. These tests use a real SQLite database.
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
vi.mock('@/lib/services/approval-workflow.service', () => ({
  submitForApproval: vi.fn(() => Promise.resolve({ success: true })),
}));

import { postNote } from '@/lib/services/credit-debit-notes.service';

const ALL_TABLES = [
  schema.sqliteGLAccountTypes, schema.sqliteGLAccounts, schema.sqliteFiscalYears,
  schema.sqliteFiscalPeriods, schema.sqliteJournalEntries, schema.sqliteJournalLines,
  schema.sqliteVendors, schema.sqliteCustomers, schema.sqliteAPInvoices,
  schema.sqliteAPInvoiceLines, schema.sqliteARInvoices, schema.sqliteARInvoiceLines,
  schema.sqliteVATTransactions, schema.sqliteCreditDebitNotes,
  schema.sqliteCreditDebitNoteLines, schema.sqliteAuditTrail,
];

const USER_ID = 1;
const NOTE_DATE = '2026-01-15';

/** Seed an invoice + an already-approved note so we exercise postNote() in isolation. */
function seedApprovedNote(opts: {
  noteId: number;
  noteType: 'ar_credit' | 'ar_debit' | 'ap_credit' | 'ap_debit';
  subtotal: number;
  vatAmount: number;
  incomeAccountId: number;
}) {
  const { noteId, noteType, subtotal, vatAmount, incomeAccountId } = opts;
  const total = subtotal + vatAmount;
  const isAR = noteType.startsWith('ar_');

  if (isAR) {
    testSqlite.exec(`
      INSERT INTO ar_invoices (id, invoice_number, tax_invoice_number, customer_id, invoice_date, due_date,
        subtotal, vat_amount, total_amount, paid_amount, status, created_by, created_at, updated_at)
      VALUES (${noteId}, 'INV-AR-${noteId}', 'TAX-${noteId}', 1, '${NOTE_DATE}', '2026-02-14',
        10000, 700, 10700, 0, 'posted', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  } else {
    testSqlite.exec(`
      INSERT INTO ap_invoices (id, invoice_number, vendor_id, invoice_date, due_date, received_date,
        subtotal, vat_amount, total_amount, paid_amount, status, created_by, created_at, updated_at)
      VALUES (${noteId}, 'INV-AP-${noteId}', 1, '${NOTE_DATE}', '2026-02-14', '${NOTE_DATE}',
        10000, 700, 10700, 0, 'posted', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  }

  testSqlite.exec(`
    INSERT INTO credit_debit_notes (id, note_number, note_type, reference_type, reference_invoice_id,
      customer_id, vendor_id, note_date, reason_code, subtotal, vat_rate, vat_amount, wht_amount,
      total_amount, status, created_by, created_at, updated_at)
    VALUES (${noteId}, 'CN-${noteId}', '${noteType}', '${isAR ? 'ar_invoice' : 'ap_invoice'}', ${noteId},
      ${isAR ? 1 : 'NULL'}, ${isAR ? 'NULL' : 1}, '${NOTE_DATE}', 'return', ${subtotal}, 7, ${vatAmount}, 0,
      ${total}, 'approved', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  testSqlite.exec(`
    INSERT INTO credit_debit_note_lines (note_id, line_number, description, quantity, unit_price,
      line_total, gl_account_id, created_at)
    VALUES (${noteId}, 1, 'Returned goods', 1, ${subtotal}, ${subtotal}, ${incomeAccountId}, CURRENT_TIMESTAMP)
  `);
}

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

describe('AR credit note (reduces what the customer owes)', () => {
  it('posts Dr Revenue + Dr Output VAT / Cr AR, and balances', async () => {
    seedApprovedNote({
      noteId: 1, noteType: 'ar_credit',
      subtotal: 1000, vatAmount: 70,
      incomeAccountId: ACCT_TEST_IDS.SALES_REVENUE,
    });

    const result = await postNote(1, USER_ID);
    expect(result.success).toBe(true);
    expect(result.journalEntryId).toBeDefined();

    // Revenue is reversed (debited), AR is reduced (credited)
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(1000);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.OUTPUT_VAT)).toBe(70);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(-1070);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });
});

describe('AR debit note (increases what the customer owes)', () => {
  it('posts Dr AR / Cr Revenue + Cr Output VAT — the branch that produced NO lines before', async () => {
    seedApprovedNote({
      noteId: 2, noteType: 'ar_debit',
      subtotal: 500, vatAmount: 35,
      incomeAccountId: ACCT_TEST_IDS.SALES_REVENUE,
    });

    const result = await postNote(2, USER_ID);
    expect(result.success).toBe(true);

    // THE REGRESSION: a debit note used to emit zero journal lines.
    const lineCount = testSqlite
      .prepare('SELECT COUNT(*) AS c FROM journal_lines WHERE journal_entry_id = ?')
      .get(result.journalEntryId) as { c: number };
    expect(lineCount.c).toBe(3); // revenue + VAT + AR

    // Mirror image of the credit note
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AR_DOMESTIC)).toBe(535);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.SALES_REVENUE)).toBe(-500);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.OUTPUT_VAT)).toBe(-35);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });
});

describe('AP credit note (reduces what we owe the vendor)', () => {
  it('posts Dr AP / Cr Expense + Cr Input VAT, and balances', async () => {
    seedApprovedNote({
      noteId: 3, noteType: 'ap_credit',
      subtotal: 2000, vatAmount: 140,
      incomeAccountId: ACCT_TEST_IDS.INVENTORY_RAW,
    });

    const result = await postNote(3, USER_ID);
    expect(result.success).toBe(true);

    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(2140);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_RAW)).toBe(-2000);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(-140);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });
});

describe('AP debit note (increases what we owe the vendor)', () => {
  it('posts Dr Expense + Dr Input VAT / Cr AP — also produced NO lines before', async () => {
    seedApprovedNote({
      noteId: 4, noteType: 'ap_debit',
      subtotal: 800, vatAmount: 56,
      incomeAccountId: ACCT_TEST_IDS.INVENTORY_RAW,
    });

    const result = await postNote(4, USER_ID);
    expect(result.success).toBe(true);

    const lineCount = testSqlite
      .prepare('SELECT COUNT(*) AS c FROM journal_lines WHERE journal_entry_id = ?')
      .get(result.journalEntryId) as { c: number };
    expect(lineCount.c).toBe(3);

    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INVENTORY_RAW)).toBe(800);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.INPUT_VAT_RECV)).toBe(56);
    expect(getAccountBalance(testSqlite, ACCT_TEST_IDS.AP_DOMESTIC)).toBe(-856);

    expect(verifyTrialBalance(testSqlite).isBalanced).toBe(true);
  });
});

describe('Notes go through the double-entry core', () => {
  it('the posted entry is linked to a fiscal period (raw inserts left it NULL)', async () => {
    seedApprovedNote({
      noteId: 5, noteType: 'ar_credit',
      subtotal: 100, vatAmount: 7,
      incomeAccountId: ACCT_TEST_IDS.SALES_REVENUE,
    });

    const result = await postNote(5, USER_ID);
    expect(result.success).toBe(true);

    const entry = testSqlite
      .prepare('SELECT fiscal_period_id, status, entry_number FROM journal_entries WHERE id = ?')
      .get(result.journalEntryId) as {
        fiscal_period_id: number | null;
        status: string;
        entry_number: string;
      };

    expect(entry.fiscal_period_id).not.toBeNull();
    expect(entry.status).toBe('posted');
    // Entry number comes from the shared generator, not the old race-prone COUNT(*)+1
    expect(entry.entry_number).toMatch(/^JE-\d{6}-\d+$/);
  });

  it('adjusts the referenced invoice total (there is no balance_due column)', async () => {
    seedApprovedNote({
      noteId: 6, noteType: 'ar_credit',
      subtotal: 1000, vatAmount: 70,
      incomeAccountId: ACCT_TEST_IDS.SALES_REVENUE,
    });

    const result = await postNote(6, USER_ID);
    expect(result.success).toBe(true);

    const invoice = testSqlite
      .prepare('SELECT total_amount, paid_amount FROM ar_invoices WHERE id = 6')
      .get() as { total_amount: number; paid_amount: number };

    // Credit note reduces the invoice: 10700 - 1070
    expect(Number(invoice.total_amount)).toBe(9630);
    expect(result.invoiceNewBalance).toBe(9630);
  });

  it('refuses to post a note that is not approved', async () => {
    seedApprovedNote({
      noteId: 7, noteType: 'ar_credit',
      subtotal: 100, vatAmount: 7,
      incomeAccountId: ACCT_TEST_IDS.SALES_REVENUE,
    });
    testSqlite.exec(`UPDATE credit_debit_notes SET status = 'draft' WHERE id = 7`);

    const result = await postNote(7, USER_ID);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/approved/i);
  });
});
