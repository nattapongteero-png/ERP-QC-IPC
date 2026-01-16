/**
 * Accounting Service Integration Tests
 * Feature: 014-unit-cost
 *
 * Tests execute real database queries against SQLite to catch schema mismatch bugs.
 * Focus: Verify all SQL queries work without schema errors.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import * as schema from '@/lib/db/schema';
import Database from 'better-sqlite3';

// Hoisted getter/setter for test database
const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: unknown = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: unknown) => { _testDb = db; },
  };
});

// Mock the database module BEFORE importing the service
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  markSchemaSynced: () => {},
  schema,
}));

// Mock audit
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// Mock matching service
vi.mock('@/lib/services/matching.service', () => ({
  runMatching: vi.fn().mockResolvedValue(undefined),
}));

// Import test helpers after mock setup
import {
  setupTestDatabase,
  closeTestDatabase,
  cleanTables,
  TestDatabase,
} from '../../../helpers/test-db';
import { seedTestUser } from '../../../helpers/service-test-seeds';
import { getSqliteDate } from '../../../helpers/service-test-utils';

// Now import the service (after mock is set up)
import {
  generateEntryNumber,
  getCurrentFiscalPeriod,
  isPeriodOpen,
  createJournalEntry,
  getJournalEntryById,
  listJournalEntries,
  listGLAccountTypes,
  listGLAccounts,
  createGLAccount,
  getGLAccountById,
  createFiscalYear,
  listFiscalYears,
  calculateVAT,
} from '@/lib/services/accounting.service';

describe('Accounting Service', () => {
  let sqlite: Database.Database;
  let db: TestDatabase;

  beforeAll(() => {
    // Setup test database with required tables
    const setup = setupTestDatabase([
      schema.sqliteUsers,
      schema.sqliteAuditTrail,
      schema.sqliteVendors,
      schema.sqliteCustomers,
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteJournalEntries,
      schema.sqliteJournalLines,
      schema.sqliteAPInvoices,
      schema.sqliteAPInvoiceLines,
      schema.sqliteARInvoices,
      schema.sqliteARInvoiceLines,
      schema.sqlitePayments,
      schema.sqlitePaymentAllocations,
      schema.sqliteVATTransactions,
      schema.sqliteWHTTransactions,
    ]);
    sqlite = setup.sqlite;
    db = setup.db;
    setTestDb(db);
  });

  afterAll(() => {
    closeTestDatabase(sqlite);
  });

  beforeEach(() => {
    // Clean tables before each test (in FK order)
    cleanTables(sqlite, [
      'payment_allocations',
      'payments',
      'wht_transactions',
      'vat_transactions',
      'journal_lines',
      'journal_entries',
      'ar_invoice_lines',
      'ar_invoices',
      'ap_invoice_lines',
      'ap_invoices',
      'fiscal_periods',
      'fiscal_years',
      'gl_accounts',
      'gl_account_types',
      'customers',
      'vendors',
      'users',
    ]);
    // Seed test user
    seedTestUser(sqlite);
  });

  // Seed helpers with CORRECT schema columns
  function seedAccountTypes() {
    // gl_account_types: id, code, name_th, name_en, category, normal_balance, display_order, created_at, updated_at
    sqlite.exec(`
      INSERT INTO gl_account_types (id, code, name_th, name_en, category, normal_balance, display_order, created_at, updated_at)
      VALUES
        (1, 'ASSET', 'สินทรัพย์', 'Assets', 'asset', 'debit', 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 'LIABILITY', 'หนี้สิน', 'Liabilities', 'liability', 'credit', 2, '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 'EQUITY', 'ส่วนของเจ้าของ', 'Equity', 'equity', 'credit', 3, '${getSqliteDate()}', '${getSqliteDate()}'),
        (4, 'REVENUE', 'รายได้', 'Revenue', 'revenue', 'credit', 4, '${getSqliteDate()}', '${getSqliteDate()}'),
        (5, 'EXPENSE', 'ค่าใช้จ่าย', 'Expenses', 'expense', 'debit', 5, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedGLAccounts() {
    seedAccountTypes();
    // gl_accounts: id, code, name_th, name_en, account_type_id, parent_id, level, is_active, is_postable, created_at, updated_at
    sqlite.exec(`
      INSERT INTO gl_accounts (id, code, name_th, name_en, account_type_id, parent_id, level, is_active, is_postable, created_at, updated_at)
      VALUES
        (1, '1000', 'เงินสดและธนาคาร', 'Cash and Bank', 1, NULL, 0, 1, 0, '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, '1001', 'เงินสดในมือ', 'Cash on Hand', 1, 1, 1, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, '1002', 'เงินฝากธนาคาร', 'Bank - Current', 1, 1, 1, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (4, '2000', 'เจ้าหนี้การค้า', 'Accounts Payable', 2, NULL, 0, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (5, '4000', 'รายได้จากการขาย', 'Sales Revenue', 4, NULL, 0, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}'),
        (6, '5000', 'ต้นทุนขาย', 'Cost of Goods Sold', 5, NULL, 0, 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedFiscalYear() {
    // fiscal_years: id, year_code, start_date, end_date, is_current, status, created_at, updated_at
    sqlite.exec(`
      INSERT INTO fiscal_years (id, year_code, start_date, end_date, is_current, status, created_at, updated_at)
      VALUES (1, 'FY2024', '2024-01-01', '2024-12-31', 1, 'open', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // fiscal_periods: id, fiscal_year_id, period_number, period_name, start_date, end_date, status, created_at, updated_at
    sqlite.exec(`
      INSERT INTO fiscal_periods (id, fiscal_year_id, period_number, period_name, start_date, end_date, status, created_at, updated_at)
      VALUES
        (1, 1, 1, '2024-01', '2024-01-01', '2024-01-31', 'closed', '${getSqliteDate()}', '${getSqliteDate()}'),
        (2, 1, 2, '2024-02', '2024-02-01', '2024-02-29', 'open', '${getSqliteDate()}', '${getSqliteDate()}'),
        (3, 1, 3, '2024-03', '2024-03-01', '2024-03-31', 'open', '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedAccountingData() {
    seedGLAccounts();
    seedFiscalYear();
    sqlite.exec(`
      INSERT INTO vendors (id, code, name, is_approved, is_active, created_at, updated_at)
      VALUES (1, 'V001', 'Test Vendor', 1, 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    sqlite.exec(`
      INSERT INTO customers (id, code, name, is_active, created_at, updated_at)
      VALUES (1, 'C001', 'Test Customer', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
  }

  function seedJournalEntry() {
    seedAccountingData();
    sqlite.exec(`
      INSERT INTO journal_entries (id, entry_number, entry_date, fiscal_period_id, description, total_debit, total_credit, source_type, status, created_by, created_at, updated_at)
      VALUES (1, 'JE-202402-0001', '2024-02-15', 2, 'Test Journal Entry', 1000, 1000, 'MANUAL', 'DRAFT', 1, '${getSqliteDate()}', '${getSqliteDate()}')
    `);
    // journal_lines uses gl_account_id, not account_id, and debit/credit (not debit_amount/credit_amount)
    sqlite.exec(`
      INSERT INTO journal_lines (id, journal_entry_id, gl_account_id, debit, credit, description, line_number, created_at)
      VALUES
        (1, 1, 2, 1000, 0, 'Debit line', 1, '${getSqliteDate()}'),
        (2, 1, 4, 0, 1000, 'Credit line', 2, '${getSqliteDate()}')
    `);
  }

  describe('listGLAccountTypes', () => {
    it('should query without schema errors', async () => {
      seedAccountTypes();

      const result = await listGLAccountTypes();

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(5);
    });

    it('should return all account type fields', async () => {
      seedAccountTypes();

      const result = await listGLAccountTypes();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('code');
      expect(result[0]).toHaveProperty('normalBalance');
    });
  });

  describe('listGLAccounts', () => {
    it('should query without schema errors', async () => {
      seedGLAccounts();

      const result = await listGLAccounts({});

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
    });

    it('should filter by account type', async () => {
      seedGLAccounts();

      const result = await listGLAccounts({ accountTypeId: 1 });

      expect(result.every((a: { accountTypeId: number }) => a.accountTypeId === 1)).toBe(true);
    });
  });

  describe('createGLAccount', () => {
    it('should insert without schema errors', async () => {
      seedAccountTypes();

      const account = await createGLAccount({
        code: '1100',
        nameTh: 'เงินสดย่อย',
        nameEn: 'Petty Cash',
        accountTypeId: 1,
        isPostable: true,
      }, 1);

      expect(account).toBeDefined();
      expect(account.id).toBeGreaterThan(0);
    });

    it('should set default values', async () => {
      seedAccountTypes();

      const account = await createGLAccount({
        code: '1200',
        nameTh: 'ลูกหนี้การค้า',
        nameEn: 'Accounts Receivable',
        accountTypeId: 1,
        isPostable: true,
      }, 1);

      expect(account.isActive).toBe(true);
    });
  });

  describe('getGLAccountById', () => {
    it('should query without schema errors', async () => {
      seedGLAccounts();

      const account = await getGLAccountById(1);

      expect(account).toBeDefined();
      expect(account?.id).toBe(1);
    });

    it('should return null for non-existent account', async () => {
      const account = await getGLAccountById(99999);

      expect(account).toBeNull();
    });
  });

  describe('createFiscalYear', () => {
    it('should insert without schema errors', async () => {
      const fy = await createFiscalYear({
        yearCode: 'FY2025',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      }, 1);

      expect(fy).toBeDefined();
      expect(fy.id).toBeGreaterThan(0);
    });

    it('should create fiscal periods automatically', async () => {
      await createFiscalYear({
        yearCode: 'FY2025',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      }, 1);

      const periods = sqlite.prepare('SELECT * FROM fiscal_periods').all() as { fiscal_year_id: number }[];
      expect(periods.length).toBe(12); // Monthly periods
    });
  });

  describe('listFiscalYears', () => {
    it('should query without schema errors', async () => {
      seedFiscalYear();

      const result = await listFiscalYears();

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCurrentFiscalPeriod', () => {
    it('should query without schema errors', async () => {
      seedFiscalYear();

      // This may return null if current date doesn't match seeded periods
      const period = await getCurrentFiscalPeriod();

      // Just verify the query doesn't error
      expect(period === null || period !== undefined).toBe(true);
    });
  });

  describe('isPeriodOpen', () => {
    it('should query without schema errors', async () => {
      seedFiscalYear();

      const isOpen = await isPeriodOpen(2); // Period 2 is open

      expect(typeof isOpen).toBe('boolean');
      expect(isOpen).toBe(true);
    });

    it('should return false for closed period', async () => {
      seedFiscalYear();

      const isOpen = await isPeriodOpen(1); // Period 1 is closed

      expect(isOpen).toBe(false);
    });
  });

  describe('generateEntryNumber', () => {
    it('should generate without schema errors', async () => {
      seedFiscalYear();

      const entryNumber = await generateEntryNumber('2024-02-15');

      expect(entryNumber).toBeDefined();
      expect(typeof entryNumber).toBe('string');
    });

    it('should include date prefix', async () => {
      seedFiscalYear();

      const entryNumber = await generateEntryNumber('2024-02-15');

      expect(entryNumber).toContain('JE-202402');
    });
  });

  describe('createJournalEntry', () => {
    it('should insert without schema errors', async () => {
      seedAccountingData();

      const entry = await createJournalEntry({
        entryDate: '2024-02-15',
        description: 'Test entry',
        sourceType: 'MANUAL',
        lines: [
          { glAccountId: 2, debit: 500, credit: 0, description: 'Debit' },
          { glAccountId: 4, debit: 0, credit: 500, description: 'Credit' },
        ],
        createdBy: 1,
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeGreaterThan(0);
    });

    it('should set status to draft', async () => {
      seedAccountingData();

      const entry = await createJournalEntry({
        entryDate: '2024-02-15',
        description: 'Draft entry',
        sourceType: 'MANUAL',
        lines: [
          { glAccountId: 2, debit: 1000, credit: 0, description: 'Debit' },
          { glAccountId: 4, debit: 0, credit: 1000, description: 'Credit' },
        ],
        createdBy: 1,
      });

      expect(entry.status).toBe('draft');
    });

    it('should calculate totals', async () => {
      seedAccountingData();

      const entry = await createJournalEntry({
        entryDate: '2024-02-15',
        description: 'Total test',
        sourceType: 'MANUAL',
        lines: [
          { glAccountId: 2, debit: 750, credit: 0, description: 'Debit' },
          { glAccountId: 4, debit: 0, credit: 750, description: 'Credit' },
        ],
        createdBy: 1,
      });

      expect(entry.totalDebit).toBe(750);
      expect(entry.totalCredit).toBe(750);
    });
  });

  describe('getJournalEntryById', () => {
    it('should query without schema errors', async () => {
      seedJournalEntry();

      const entry = await getJournalEntryById(1);

      expect(entry).toBeDefined();
      expect(entry.id).toBe(1);
    });

    it('should include lines', async () => {
      seedJournalEntry();

      const entry = await getJournalEntryById(1);

      expect(entry.lines).toBeInstanceOf(Array);
      expect(entry.lines.length).toBe(2);
    });
  });

  describe('listJournalEntries', () => {
    it('should query without schema errors', async () => {
      seedJournalEntry();

      const result = await listJournalEntries({});

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(Array);
    });

    it('should filter by status', async () => {
      seedJournalEntry();

      const result = await listJournalEntries({ status: 'draft' });

      expect(result.every((e: { status: string }) => e.status === 'draft')).toBe(true);
    });

    it('should return results as array', async () => {
      seedJournalEntry();

      const result = await listJournalEntries({});

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Tax Calculations', () => {
    it('calculateVAT should work correctly (exclusive)', () => {
      // isInclusive = false means VAT is added on top (exclusive)
      const result = calculateVAT(1000, false);

      expect(result).toHaveProperty('baseAmount');
      expect(result).toHaveProperty('vatAmount');
      expect(result).toHaveProperty('totalAmount');
      // VAT 7% on 1000 = 70
      expect(result.vatAmount).toBeCloseTo(70, 0);
      expect(result.totalAmount).toBeCloseTo(1070, 0);
    });

    it('calculateVAT inclusive should extract VAT', () => {
      // isInclusive = true means amount already includes VAT
      const result = calculateVAT(1070, true);

      expect(result.baseAmount).toBeCloseTo(1000, 0);
      expect(result.vatAmount).toBeCloseTo(70, 0);
    });
  });

  describe('Schema Validation', () => {
    it('should handle all GL account columns correctly', async () => {
      seedAccountTypes();

      const account = await createGLAccount({
        code: '9999',
        nameTh: 'ทดสอบ',
        nameEn: 'Schema Test',
        accountTypeId: 1,
        isPostable: true,
        description: 'Test description',
      }, 1);

      expect(account).toHaveProperty('id');
      expect(account).toHaveProperty('code');
      expect(account).toHaveProperty('accountTypeId');
      expect(account).toHaveProperty('isActive');
      expect(account).toHaveProperty('createdAt');
      expect(account).toHaveProperty('updatedAt');
    });

    it('should handle all journal entry columns correctly', async () => {
      seedAccountingData();

      const entry = await createJournalEntry({
        entryDate: '2024-02-20',
        description: 'Schema test entry',
        sourceType: 'MANUAL',
        lines: [
          { glAccountId: 2, debit: 100, credit: 0, description: 'Debit' },
          { glAccountId: 4, debit: 0, credit: 100, description: 'Credit' },
        ],
        createdBy: 1,
      });

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('entryNumber');
      expect(entry).toHaveProperty('entryDate');
      expect(entry).toHaveProperty('description');
      expect(entry).toHaveProperty('totalDebit');
      expect(entry).toHaveProperty('totalCredit');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('createdAt');
    });
  });
});
