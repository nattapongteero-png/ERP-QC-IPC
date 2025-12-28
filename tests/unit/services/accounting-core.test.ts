/**
 * Accounting Core Service Unit Tests
 * Feature: 010-accounting-module-integration
 *
 * Tests core accounting functions:
 * - generateEntryNumber()
 * - getCurrentFiscalPeriod() / getPeriodByDate()
 * - createJournalEntry() with balance validation
 * - postJournalEntry() with period check
 * - reverseJournalEntry()
 * - calculateVAT() / calculateWHT()
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
  ACCT_TEST_IDS,
  ACCT_TEST_DATES,
} from '../../helpers/seed-accounting';

const { getTestDb, setTestDb } = vi.hoisted(() => {
  let _testDb: any = null;
  return {
    getTestDb: () => _testDb,
    setTestDb: (db: any) => { _testDb = db; },
  };
});

let testSqlite: Database.Database;
let testDb: any;

vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  getDb: async () => getTestDb(),
  getSqliteDb: () => getTestDb(),
  schema,
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  createAuditLog: vi.fn(() => Promise.resolve()),
}));

// Import after mocks are set up
import {
  generateEntryNumber,
  getCurrentFiscalPeriod,
  getPeriodByDate,
  isPeriodOpen,
  createJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  calculateVAT,
  calculateWHT,
  THAI_VAT_RATE,
} from '@/lib/services/accounting.service';

describe('Accounting Core Service', () => {
  beforeEach(() => {
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });
    setTestDb(testDb);

    const tables = [
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteJournalEntries,
      schema.sqliteJournalLines,
      schema.sqliteUsers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        // Table might already exist
      }
    }

    // Seed test data
    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);

    // Create test user
    testSqlite.exec(`
      INSERT OR IGNORE INTO users (id, name, email, password, role, is_active)
      VALUES (1, 'Test User', 'test@test.com', 'hash', 'admin', 1)
    `);
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
    vi.clearAllMocks();
  });

  // ============================================
  // VAT/WHT Calculation Tests
  // ============================================

  describe('calculateVAT', () => {
    it('should calculate VAT exclusive correctly (7%)', () => {
      const result = calculateVAT(1000, false);

      expect(result.baseAmount).toBe(1000);
      expect(result.vatAmount).toBe(70);
      expect(result.totalAmount).toBe(1070);
    });

    it('should extract VAT from inclusive amount correctly', () => {
      const result = calculateVAT(1070, true);

      expect(result.baseAmount).toBeCloseTo(1000, 2);
      expect(result.vatAmount).toBeCloseTo(70, 2);
      expect(result.totalAmount).toBe(1070);
    });

    it('should handle zero amount', () => {
      const result = calculateVAT(0, false);

      expect(result.baseAmount).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should round VAT to 2 decimal places', () => {
      const result = calculateVAT(99.99, false);

      expect(result.vatAmount).toBe(7); // 99.99 * 0.07 = 6.9993 rounded to 7
    });
  });

  describe('calculateWHT', () => {
    it('should calculate 3% WHT correctly', () => {
      const result = calculateWHT(1000, 3);

      expect(result.whtAmount).toBe(30);
      expect(result.netPayment).toBe(970);
    });

    it('should calculate 5% WHT correctly (rent)', () => {
      const result = calculateWHT(10000, 5);

      expect(result.whtAmount).toBe(500);
      expect(result.netPayment).toBe(9500);
    });

    it('should handle 0% WHT (salary)', () => {
      const result = calculateWHT(50000, 0);

      expect(result.whtAmount).toBe(0);
      expect(result.netPayment).toBe(50000);
    });
  });

  describe('THAI_VAT_RATE', () => {
    it('should be 7% (0.07)', () => {
      expect(THAI_VAT_RATE).toBe(0.07);
    });
  });

  // ============================================
  // Entry Number Generation Tests
  // ============================================

  describe('generateEntryNumber', () => {
    it('should generate entry number in format JE-YYYYMM-NNNNNN', async () => {
      const entryNumber = await generateEntryNumber('2025-01-15');

      expect(entryNumber).toMatch(/^JE-202501-\d{6}$/);
      expect(entryNumber).toBe('JE-202501-000001');
    });

    it('should increment sequence for same month', async () => {
      // Create first entry
      testSqlite.exec(`
        INSERT INTO journal_entries (entry_number, entry_date, fiscal_period_id, status, total_debit, total_credit, created_by, created_at, updated_at)
        VALUES ('JE-202501-000001', '2025-01-15', 1, 'draft', 100, 100, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const entryNumber = await generateEntryNumber('2025-01-20');

      expect(entryNumber).toBe('JE-202501-000002');
    });

    it('should reset sequence for different month', async () => {
      // Create entry for January
      testSqlite.exec(`
        INSERT INTO journal_entries (entry_number, entry_date, fiscal_period_id, status, total_debit, total_credit, created_by, created_at, updated_at)
        VALUES ('JE-202501-000005', '2025-01-15', 1, 'draft', 100, 100, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);

      const entryNumber = await generateEntryNumber('2025-02-15');

      expect(entryNumber).toBe('JE-202502-000001');
    });

    it('should handle Date object input', async () => {
      const entryNumber = await generateEntryNumber(new Date('2025-03-15'));

      expect(entryNumber).toBe('JE-202503-000001');
    });
  });

  // ============================================
  // Fiscal Period Tests
  // ============================================

  describe('getPeriodByDate', () => {
    it('should find fiscal period for a given date', async () => {
      const period = await getPeriodByDate('2025-01-15');

      expect(period).not.toBeNull();
      expect(period?.periodNumber).toBe(1);
      expect(period?.periodName).toBe('January');
      expect(period?.status).toBe('open');
    });

    it('should return null for date outside fiscal year', async () => {
      const period = await getPeriodByDate('2024-01-15');

      expect(period).toBeNull();
    });

    it('should find December period correctly', async () => {
      const period = await getPeriodByDate('2025-12-25');

      expect(period).not.toBeNull();
      expect(period?.periodNumber).toBe(12);
      expect(period?.periodName).toBe('December');
    });
  });

  describe('isPeriodOpen', () => {
    it('should return true for open period', async () => {
      const isOpen = await isPeriodOpen(ACCT_TEST_IDS.FISCAL_PERIOD_JAN);

      expect(isOpen).toBe(true);
    });

    it('should return false for non-existent period', async () => {
      const isOpen = await isPeriodOpen(999);

      expect(isOpen).toBe(false);
    });

    it('should return false for closed period', async () => {
      // Close the period
      testSqlite.exec(`
        UPDATE fiscal_periods SET status = 'closed' WHERE id = ${ACCT_TEST_IDS.FISCAL_PERIOD_JAN}
      `);

      const isOpen = await isPeriodOpen(ACCT_TEST_IDS.FISCAL_PERIOD_JAN);

      expect(isOpen).toBe(false);
    });

    it('should return false when fiscal year is closed', async () => {
      // Close the fiscal year
      testSqlite.exec(`
        UPDATE fiscal_years SET status = 'closed' WHERE id = ${ACCT_TEST_IDS.FISCAL_YEAR_2025}
      `);

      const isOpen = await isPeriodOpen(ACCT_TEST_IDS.FISCAL_PERIOD_JAN);

      expect(isOpen).toBe(false);
    });
  });

  // ============================================
  // Journal Entry Creation Tests
  // ============================================

  describe('createJournalEntry', () => {
    it('should create a balanced journal entry', async () => {
      const entry = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Test entry',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 1000, credit: 0, description: 'Debit cash' },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 1000, description: 'Credit revenue' },
        ],
        createdBy: 1,
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBeGreaterThan(0);
      expect(entry.entryNumber).toMatch(/^JE-202501-\d{6}$/);
      expect(entry.status).toBe('draft');
      expect(entry.totalDebit).toBe(1000);
      expect(entry.totalCredit).toBe(1000);
      expect(entry.lines).toHaveLength(2);
    });

    it('should reject unbalanced journal entry', async () => {
      await expect(
        createJournalEntry({
          entryDate: '2025-01-15',
          description: 'Unbalanced entry',
          lines: [
            { glAccountId: ACCT_TEST_IDS.CASH, debit: 1000, credit: 0 },
            { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 500 },
          ],
          createdBy: 1,
        })
      ).rejects.toThrow('not balanced');
    });

    it('should require at least 2 lines', async () => {
      await expect(
        createJournalEntry({
          entryDate: '2025-01-15',
          description: 'Single line entry',
          lines: [{ glAccountId: ACCT_TEST_IDS.CASH, debit: 1000, credit: 0 }],
          createdBy: 1,
        })
      ).rejects.toThrow('at least 2 lines');
    });

    it('should auto-determine fiscal period from entry date', async () => {
      const entry = await createJournalEntry({
        entryDate: '2025-02-15',
        description: 'February entry',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 500, credit: 0 },
          { glAccountId: ACCT_TEST_IDS.AR_DOMESTIC, debit: 0, credit: 500 },
        ],
        createdBy: 1,
      });

      expect(entry.fiscalPeriodId).toBe(ACCT_TEST_IDS.FISCAL_PERIOD_FEB);
    });

    it('should reject entry with no fiscal period', async () => {
      await expect(
        createJournalEntry({
          entryDate: '2024-01-15', // Before our test fiscal year
          description: 'Invalid period',
          lines: [
            { glAccountId: ACCT_TEST_IDS.CASH, debit: 100, credit: 0 },
            { glAccountId: ACCT_TEST_IDS.BANK_ACCOUNT, debit: 0, credit: 100 },
          ],
          createdBy: 1,
        })
      ).rejects.toThrow('No fiscal period found');
    });

    it('should handle multi-line entries (more than 2 lines)', async () => {
      const entry = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Multi-line entry',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 1070, credit: 0, description: 'Cash received' },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 1000, description: 'Sales' },
          { glAccountId: ACCT_TEST_IDS.OUTPUT_VAT, debit: 0, credit: 70, description: 'Output VAT' },
        ],
        createdBy: 1,
      });

      expect(entry.lines).toHaveLength(3);
      expect(entry.totalDebit).toBe(1070);
      expect(entry.totalCredit).toBe(1070);
    });

    it('should set source type when provided', async () => {
      const entry = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Sales entry',
        sourceType: 'SO_SHIPMENT',
        sourceId: 123,
        lines: [
          { glAccountId: ACCT_TEST_IDS.AR_DOMESTIC, debit: 1000, credit: 0 },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 1000 },
        ],
        createdBy: 1,
      });

      expect(entry.sourceType).toBe('SO_SHIPMENT');
      expect(entry.sourceId).toBe(123);
    });
  });

  // ============================================
  // Journal Entry Posting Tests
  // ============================================

  describe('postJournalEntry', () => {
    let draftEntryId: number;

    beforeEach(async () => {
      // Create a draft entry
      const entry = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Entry to post',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 1000, credit: 0 },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 1000 },
        ],
        createdBy: 1,
      });
      draftEntryId = entry.id;
    });

    it('should post a draft journal entry', async () => {
      const posted = await postJournalEntry(draftEntryId, 1);

      expect(posted.status).toBe('posted');
      expect(posted.postedBy).toBe(1);
      expect(posted.postedAt).not.toBeNull();
    });

    it('should reject posting already posted entry', async () => {
      await postJournalEntry(draftEntryId, 1);

      await expect(postJournalEntry(draftEntryId, 1)).rejects.toThrow('Only draft entries can be posted');
    });

    it('should reject posting to closed period', async () => {
      // Close the period
      testSqlite.exec(`
        UPDATE fiscal_periods SET status = 'closed' WHERE id = ${ACCT_TEST_IDS.FISCAL_PERIOD_JAN}
      `);

      await expect(postJournalEntry(draftEntryId, 1)).rejects.toThrow('closed fiscal period');
    });

    it('should reject posting non-existent entry', async () => {
      await expect(postJournalEntry(99999, 1)).rejects.toThrow('not found');
    });
  });

  // ============================================
  // Journal Entry Reversal Tests
  // ============================================

  describe('reverseJournalEntry', () => {
    let postedEntryId: number;

    beforeEach(async () => {
      // Create and post an entry
      const entry = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Entry to reverse',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 1000, credit: 0 },
          { glAccountId: ACCT_TEST_IDS.SALES_REVENUE, debit: 0, credit: 1000 },
        ],
        createdBy: 1,
      });
      const posted = await postJournalEntry(entry.id, 1);
      postedEntryId = posted.id;
    });

    it('should create a reversing entry with swapped debits/credits', async () => {
      const reversal = await reverseJournalEntry(postedEntryId, 1);

      expect(reversal).toBeDefined();
      expect(reversal.status).toBe('posted'); // Reversals are auto-posted
      expect(reversal.description).toContain('Reversal of');
      expect(reversal.totalDebit).toBe(1000);
      expect(reversal.totalCredit).toBe(1000);

      // Check that debits and credits are swapped
      const originalDebitAccount = reversal.lines?.find((l) => l.glAccountId === ACCT_TEST_IDS.CASH);
      expect(originalDebitAccount?.credit).toBe(1000);
      expect(originalDebitAccount?.debit).toBe(0);
    });

    it('should mark original entry as reversed', async () => {
      const reversal = await reverseJournalEntry(postedEntryId, 1);

      // Check original entry status
      const original = testSqlite
        .prepare('SELECT status, reversal_entry_id FROM journal_entries WHERE id = ?')
        .get(postedEntryId) as { status: string; reversal_entry_id: number };

      expect(original.status).toBe('reversed');
      expect(original.reversal_entry_id).toBe(reversal.id);
    });

    it('should reject reversing draft entry', async () => {
      // Create new draft entry
      const draft = await createJournalEntry({
        entryDate: '2025-01-15',
        description: 'Draft entry',
        lines: [
          { glAccountId: ACCT_TEST_IDS.CASH, debit: 500, credit: 0 },
          { glAccountId: ACCT_TEST_IDS.BANK_ACCOUNT, debit: 0, credit: 500 },
        ],
        createdBy: 1,
      });

      await expect(reverseJournalEntry(draft.id, 1)).rejects.toThrow('Only posted entries can be reversed');
    });

    it('should reject reversing already reversed entry', async () => {
      await reverseJournalEntry(postedEntryId, 1);

      await expect(reverseJournalEntry(postedEntryId, 1)).rejects.toThrow('Only posted entries can be reversed');
    });

    it('should use custom reversal date when provided', async () => {
      const reversal = await reverseJournalEntry(postedEntryId, 1, '2025-01-20');

      expect(reversal.entryDate).toBe('2025-01-20');
    });

    it('should include reason in reversal description when provided', async () => {
      const reversal = await reverseJournalEntry(postedEntryId, 1, undefined, 'Duplicate entry');

      expect(reversal.description).toContain('Duplicate entry');
    });

    it('should reject reversal if reversal period is closed', async () => {
      // Close all periods
      testSqlite.exec(`UPDATE fiscal_periods SET status = 'closed'`);

      await expect(reverseJournalEntry(postedEntryId, 1)).rejects.toThrow('closed fiscal period');
    });
  });
});
