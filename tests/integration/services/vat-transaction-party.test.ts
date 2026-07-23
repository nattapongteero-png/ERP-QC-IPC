/**
 * Tax-invoice party regression tests (list items 30-31).
 *
 * Every tax invoice the app issued was stored with partyName 'Unknown' and
 * partyTaxId '0000000000000', because createVATTransaction's callers only pass
 * customerId/vendorId and never the party details. A Thai tax invoice without
 * the buyer's registered name and tax ID is not legally valid, so these lock
 * down that the party is resolved from the customer/vendor record.
 *
 * Runs against a real (SQLite) database — no mocking of the insert path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

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

import { createVATTransaction } from '@/lib/services/accounting.service';

const ALL_TABLES = [
  schema.sqliteCustomers,
  schema.sqliteVendors,
  schema.sqliteVATTransactions,
];

const CUSTOMER_ID = 501;
const VENDOR_ID = 601;
const CUSTOMER_NAME = 'บริษัท สมุนไพรทดสอบ จำกัด';
const CUSTOMER_TAX_ID = '0105558123456';
const VENDOR_NAME = 'ห้างหุ้นส่วน ผู้ขายทดสอบ';
const VENDOR_TAX_ID = '0993000111222';

beforeEach(() => {
  testSqlite = new Database(':memory:');
  testSqlite.pragma('foreign_keys = OFF');
  for (const table of ALL_TABLES) {
    testSqlite.exec(generateCreateTableSql(table));
  }
  setTestDb(drizzle(testSqlite, { schema }));

  testSqlite.exec(`
    INSERT INTO customers (id, code, name, tax_id, is_active, created_at, updated_at)
    VALUES (${CUSTOMER_ID}, 'CUS-501', '${CUSTOMER_NAME}', '${CUSTOMER_TAX_ID}', 1,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  testSqlite.exec(`
    INSERT INTO vendors (id, code, name, tax_id, is_active, created_at, updated_at)
    VALUES (${VENDOR_ID}, 'VEN-601', '${VENDOR_NAME}', '${VENDOR_TAX_ID}', 1,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
});

afterEach(() => {
  testSqlite?.close();
  setTestDb(null);
});

function readVatRow(id: number) {
  return testSqlite
    .prepare('SELECT * FROM vat_transactions WHERE id = ?')
    .get(id) as any;
}

describe('createVATTransaction party resolution', () => {
  it('resolves the customer name and tax ID from customerId (output VAT)', async () => {
    const { id } = await createVATTransaction({
      transactionType: 'output',
      customerId: CUSTOMER_ID,
      taxInvoiceNumber: 'T-202607-000001',
      taxInvoiceDate: '2026-07-01',
      taxableAmount: 4000,
      vatAmount: 280,
    });

    const row = readVatRow(id);
    expect(row.party_name).toBe(CUSTOMER_NAME);
    expect(row.party_tax_id).toBe(CUSTOMER_TAX_ID);
    // The bug this locks down:
    expect(row.party_name).not.toBe('Unknown');
    expect(row.party_tax_id).not.toBe('0000000000000');
  });

  it('resolves the vendor name and tax ID from vendorId (input VAT)', async () => {
    const { id } = await createVATTransaction({
      transactionType: 'input',
      vendorId: VENDOR_ID,
      taxInvoiceNumber: 'INV-SUP-001',
      taxInvoiceDate: '2026-07-02',
      taxableAmount: 1000,
      vatAmount: 70,
    });

    const row = readVatRow(id);
    expect(row.party_name).toBe(VENDOR_NAME);
    expect(row.party_tax_id).toBe(VENDOR_TAX_ID);
  });

  it('falls back to matching the customer by name when no customerId is given', async () => {
    // sales_orders stores only customerName, so this is the real AR path.
    const { id } = await createVATTransaction({
      transactionType: 'output',
      taxInvoiceNumber: 'T-202607-000002',
      taxInvoiceDate: '2026-07-03',
      taxableAmount: 2000,
      vatAmount: 140,
      partyName: CUSTOMER_NAME,
    });

    const row = readVatRow(id);
    expect(row.party_name).toBe(CUSTOMER_NAME);
    expect(row.party_tax_id).toBe(CUSTOMER_TAX_ID);
  });

  it('keeps explicitly supplied party details over the looked-up ones', async () => {
    const { id } = await createVATTransaction({
      transactionType: 'output',
      customerId: CUSTOMER_ID,
      taxInvoiceNumber: 'T-202607-000003',
      taxInvoiceDate: '2026-07-04',
      taxableAmount: 500,
      vatAmount: 35,
      partyName: 'ชื่อที่ระบุเอง',
      partyTaxId: '9999999999999',
    });

    const row = readVatRow(id);
    expect(row.party_name).toBe('ชื่อที่ระบุเอง');
    expect(row.party_tax_id).toBe('9999999999999');
  });

  it('still records the invoice when the party cannot be resolved', async () => {
    const { id } = await createVATTransaction({
      transactionType: 'output',
      customerId: 999999, // no such customer
      taxInvoiceNumber: 'T-202607-000004',
      taxInvoiceDate: '2026-07-05',
      taxableAmount: 100,
      vatAmount: 7,
    });

    const row = readVatRow(id);
    expect(row.party_name).toBe('Unknown');
    expect(row.party_tax_id).toBe('0000000000000');
    expect(Number(row.vat_amount)).toBe(7);
  });

  it('derives the tax period from the invoice date', async () => {
    const { id } = await createVATTransaction({
      transactionType: 'output',
      customerId: CUSTOMER_ID,
      taxInvoiceNumber: 'T-202611-000001',
      taxInvoiceDate: '2026-11-20',
      taxableAmount: 1000,
      vatAmount: 70,
    });

    expect(readVatRow(id).tax_period).toBe('202611');
  });
});
