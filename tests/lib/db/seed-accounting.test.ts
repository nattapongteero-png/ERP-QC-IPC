/**
 * Accounting Seed Tests
 * Feature: 010-accounting-module-integration
 * Verifies that accounting lookup tables are seeded correctly on server startup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/db/schema';
import { generateCreateTableSql } from '../../helpers/schema-sync';

// Store db reference for module mock
let testSqlite: Database.Database;
let testDb: any;

// Mock db module
vi.mock('@/lib/db', () => ({
  isSqlite: () => true,
  db: () => testDb,
  getSqliteDb: () => testDb,
  getMysqlDb: async () => testDb,
  markSchemaSynced: () => {},
  schema,
}));

// Mock date-utils
vi.mock('@/lib/db/date-utils', () => ({
  getNow: () => new Date().toISOString(),
  toDbDate: (date: string) => date,
  getTodayStr: () => new Date().toISOString().split('T')[0],
}));

// Import after mocks are set up
import { seedAccountingTables } from '@/lib/db/seed-accounting';

describe('Accounting Seed', () => {
  beforeEach(() => {
    // Create in-memory SQLite database
    testSqlite = new Database(':memory:');
    testSqlite.pragma('journal_mode = WAL');
    testDb = drizzle(testSqlite, { schema });

    // Create all required accounting tables
    const tables = [
      schema.sqliteGLAccountTypes,
      schema.sqliteGLAccounts,
      schema.sqliteFiscalYears,
      schema.sqliteFiscalPeriods,
      schema.sqliteAssetCategories,
      schema.sqliteUsers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch (err) {
        console.log(`Table creation note: ${err}`);
      }
    }
  });

  afterEach(() => {
    if (testSqlite) {
      testSqlite.close();
    }
  });

  describe('seedAccountingTables()', () => {
    it('seeds GL account types', async () => {
      await seedAccountingTables();

      const result = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_account_types').get() as any;

      // Should have 7 account types
      expect(result.count).toBeGreaterThanOrEqual(7);
    });

    it('seeds all standard account type categories', async () => {
      await seedAccountingTables();

      const result = testSqlite.prepare('SELECT code, category FROM gl_account_types ORDER BY code').all() as any[];

      // Check for main categories
      const codes = result.map(t => t.code);
      expect(codes).toContain('1'); // Assets
      expect(codes).toContain('2'); // Liabilities
      expect(codes).toContain('3'); // Equity
      expect(codes).toContain('4'); // Revenue
      expect(codes).toContain('5'); // COGS
      expect(codes).toContain('6'); // Operating Expenses
      expect(codes).toContain('7'); // Other Income/Expenses
    });

    it('seeds chart of accounts', async () => {
      await seedAccountingTables();

      const result = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_accounts').get() as any;

      // Should have comprehensive chart of accounts (70+ accounts)
      expect(result.count).toBeGreaterThanOrEqual(70);
    });

    it('includes cash and bank accounts', async () => {
      await seedAccountingTables();

      // Cash on Hand (1111)
      const cash = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('1111') as any;
      expect(cash).toBeDefined();
      expect(cash.name_en).toBe('Cash on Hand');

      // Bank accounts (1112, 1113) should have is_bank_account flag
      const bankSavings = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('1112') as any;
      expect(bankSavings).toBeDefined();
      expect(bankSavings.is_bank_account).toBe(1);

      const bankCurrent = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('1113') as any;
      expect(bankCurrent).toBeDefined();
      expect(bankCurrent.is_bank_account).toBe(1);
    });

    it('includes VAT accounts', async () => {
      await seedAccountingTables();

      // Input VAT (1142)
      const inputVat = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('1142') as any;
      expect(inputVat).toBeDefined();
      expect(inputVat.name_en).toBe('Input VAT');

      // Output VAT (2131)
      const outputVat = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('2131') as any;
      expect(outputVat).toBeDefined();
      expect(outputVat.name_en).toBe('Output VAT');
    });

    it('includes AR and AP accounts', async () => {
      await seedAccountingTables();

      // AR (1121)
      const ar = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('1121') as any;
      expect(ar).toBeDefined();
      expect(ar.name_en).toContain('AR');

      // AP (2111)
      const ap = testSqlite.prepare('SELECT * FROM gl_accounts WHERE code = ?').get('2111') as any;
      expect(ap).toBeDefined();
      expect(ap.name_en).toContain('AP');
    });

    it('seeds current fiscal year', async () => {
      await seedAccountingTables();

      const result = testSqlite.prepare('SELECT * FROM fiscal_years WHERE is_current = 1').get() as any;

      expect(result).toBeDefined();
      expect(result.year_code).toMatch(/^FY\d{4}$/);
      expect(result.status).toBe('open');
    });

    it('seeds 12 fiscal periods', async () => {
      await seedAccountingTables();

      const result = testSqlite.prepare('SELECT COUNT(*) as count FROM fiscal_periods').get() as any;

      expect(result.count).toBe(12);
    });

    it('fiscal periods cover January to December', async () => {
      await seedAccountingTables();

      const periods = testSqlite.prepare('SELECT period_number, period_name FROM fiscal_periods ORDER BY period_number').all() as any[];

      expect(periods.length).toBe(12);
      expect(periods[0].period_name).toBe('January');
      expect(periods[11].period_name).toBe('December');
    });

    it('is idempotent - does not duplicate data on re-run', async () => {
      // First run
      await seedAccountingTables();

      const initialTypes = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_account_types').get() as any;
      const initialAccounts = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_accounts').get() as any;
      const initialYears = testSqlite.prepare('SELECT COUNT(*) as count FROM fiscal_years').get() as any;

      // Second run
      await seedAccountingTables();

      const afterTypes = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_account_types').get() as any;
      const afterAccounts = testSqlite.prepare('SELECT COUNT(*) as count FROM gl_accounts').get() as any;
      const afterYears = testSqlite.prepare('SELECT COUNT(*) as count FROM fiscal_years').get() as any;

      // Counts should remain the same
      expect(afterTypes.count).toBe(initialTypes.count);
      expect(afterAccounts.count).toBe(initialAccounts.count);
      expect(afterYears.count).toBe(initialYears.count);
    });
  });

  describe('Chart of Accounts Structure', () => {
    it('has proper parent-child hierarchy', async () => {
      await seedAccountingTables();

      // Check that child accounts have valid parent references
      const children = testSqlite.prepare(`
        SELECT child.code as child_code, child.parent_id, child.level as child_level,
               parent.code as parent_code, parent.level as parent_level
        FROM gl_accounts child
        JOIN gl_accounts parent ON child.parent_id = parent.id
        WHERE child.parent_id IS NOT NULL
        LIMIT 10
      `).all() as any[];

      // Should have hierarchy
      expect(children.length).toBeGreaterThan(0);

      // Child level should be greater than parent level
      for (const row of children) {
        expect(row.child_level).toBeGreaterThan(row.parent_level);
        // Child code first digit should match parent code first digit (same account type)
        expect(row.child_code[0]).toBe(row.parent_code[0]);
      }
    });

    it('has correct account levels', async () => {
      await seedAccountingTables();

      // Level 1 accounts (1100, 1200, 2100, etc.)
      const level1 = testSqlite.prepare('SELECT * FROM gl_accounts WHERE level = 1').all() as any[];
      expect(level1.length).toBeGreaterThan(0);

      // Level 2 accounts
      const level2 = testSqlite.prepare('SELECT * FROM gl_accounts WHERE level = 2').all() as any[];
      expect(level2.length).toBeGreaterThan(0);

      // Level 3 accounts (most postable accounts)
      const level3 = testSqlite.prepare('SELECT * FROM gl_accounts WHERE level = 3').all() as any[];
      expect(level3.length).toBeGreaterThan(0);
    });

    it('marks group accounts as non-postable', async () => {
      await seedAccountingTables();

      // Group accounts (like 1100, 1110, 2100) should be non-postable
      const nonPostable = testSqlite.prepare(`
        SELECT code, is_postable FROM gl_accounts
        WHERE code IN ('1100', '1110', '2100', '3100', '4100', '5100', '6100')
      `).all() as any[];

      for (const account of nonPostable) {
        expect(account.is_postable).toBe(0);
      }
    });
  });
});
