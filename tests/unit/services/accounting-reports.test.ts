/**
 * Accounting Reports Service Unit Tests
 * Feature: 010-accounting-module-integration
 * User Story 5: Generate Financial Statements
 *
 * Tests financial report generation:
 * - generateTrialBalance()
 * - generateBalanceSheet()
 * - generateIncomeStatement()
 * - generateCashFlowStatement()
 * - generateAgingReport()
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
  seedJournalEntries,
  seedVendors,
  seedCustomers,
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
let testDb: ReturnType<typeof drizzle>;

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
  generateTrialBalance,
  generateBalanceSheet,
  generateIncomeStatement,
  generateCashFlowStatement,
  generateAgingReport,
} from '@/lib/services/accounting-reports.service';

describe('Accounting Reports Service', () => {
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
      schema.sqliteAPInvoices,
      schema.sqliteAPInvoiceLines,
      schema.sqliteARInvoices,
      schema.sqliteARInvoiceLines,
      schema.sqliteUsers,
      schema.sqliteVendors,
      schema.sqliteCustomers,
    ];

    for (const table of tables) {
      try {
        const createSql = generateCreateTableSql(table);
        testSqlite.exec(createSql);
      } catch {
        // Table might already exist
      }
    }

    // Seed test data
    seedGLAccountTypes(testSqlite);
    seedGLAccounts(testSqlite);
    seedFiscalYearAndPeriods(testSqlite);
    seedJournalEntries(testSqlite);
    seedVendors(testSqlite);
    seedCustomers(testSqlite);

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
  });

  // =============================================
  // Trial Balance Tests
  // =============================================
  describe('generateTrialBalance', () => {
    it('should generate trial balance as of date', async () => {
      const report = await generateTrialBalance('2025-01-31');

      expect(report).toBeDefined();
      expect(report.asOfDate).toBe('2025-01-31');
      expect(report.entries).toBeInstanceOf(Array);
      expect(report.totals).toBeDefined();
    });

    it('should include accounts with activity', async () => {
      const report = await generateTrialBalance('2025-01-31');

      // Should include AR account (from sales JE)
      const arEntry = report.entries.find((e) => e.accountCode === '1121');
      expect(arEntry).toBeDefined();
      if (arEntry) {
        expect(arEntry.periodDebit).toBeGreaterThan(0);
      }

      // Should include Sales Revenue (from sales JE)
      const salesEntry = report.entries.find((e) => e.accountCode === '4110');
      expect(salesEntry).toBeDefined();
      if (salesEntry) {
        expect(salesEntry.periodCredit).toBeGreaterThan(0);
      }
    });

    it('should have balanced totals (debits = credits)', async () => {
      const report = await generateTrialBalance('2025-01-31');

      // Period activity should be balanced
      expect(Math.abs(report.totals.periodDebit - report.totals.periodCredit)).toBeLessThan(0.01);
    });

    it('should respect fiscal year start parameter', async () => {
      const report = await generateTrialBalance('2025-01-31', '2025-01-01');

      expect(report.fiscalPeriod).toBe('2025-01-01');
    });

    it('should return empty entries for future date', async () => {
      const report = await generateTrialBalance('2024-01-01');

      // All entries should be opening balance only (no period activity)
      for (const entry of report.entries) {
        expect(entry.periodDebit).toBe(0);
        expect(entry.periodCredit).toBe(0);
      }
    });
  });

  // =============================================
  // Balance Sheet Tests
  // =============================================
  describe('generateBalanceSheet', () => {
    it('should generate balance sheet as of date', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      expect(report).toBeDefined();
      expect(report.asOfDate).toBe('2025-01-31');
      expect(report.assets).toBeDefined();
      expect(report.liabilities).toBeDefined();
      expect(report.equity).toBeDefined();
    });

    it('should have current and non-current asset sections', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      expect(report.assets.currentAssets).toBeDefined();
      expect(report.assets.currentAssets.title).toBe('Current Assets');
      expect(report.assets.nonCurrentAssets).toBeDefined();
      expect(report.assets.nonCurrentAssets.title).toBe('Non-Current Assets');
    });

    it('should have current and non-current liability sections', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      expect(report.liabilities.currentLiabilities).toBeDefined();
      expect(report.liabilities.currentLiabilities.title).toBe('Current Liabilities');
      expect(report.liabilities.nonCurrentLiabilities).toBeDefined();
      expect(report.liabilities.nonCurrentLiabilities.title).toBe('Non-Current Liabilities');
    });

    it('should be balanced (Assets = Liabilities + Equity)', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      expect(report.isBalanced).toBe(true);
      expect(
        Math.abs(report.assets.totalAssets - report.totalLiabilitiesAndEquity)
      ).toBeLessThan(0.01);
    });

    it('should include current assets from seeded data', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      // AR should be in current assets (from sales JE: 10,700)
      const arAccount = report.assets.currentAssets.accounts.find((a) => a.code === '1121');
      expect(arAccount).toBeDefined();
      if (arAccount) {
        expect(arAccount.amount).toBe(10700);
      }

      // Inventory should be in current assets (from purchase JE: 5,000)
      const invAccount = report.assets.currentAssets.accounts.find((a) => a.code === '1131');
      expect(invAccount).toBeDefined();
      if (invAccount) {
        expect(invAccount.amount).toBe(5000);
      }
    });

    it('should include current liabilities from seeded data', async () => {
      const report = await generateBalanceSheet('2025-01-31');

      // AP should be in current liabilities (from purchase JE: 5,350)
      const apAccount = report.liabilities.currentLiabilities.accounts.find((a) => a.code === '2111');
      expect(apAccount).toBeDefined();
      if (apAccount) {
        expect(apAccount.amount).toBe(5350);
      }
    });
  });

  // =============================================
  // Income Statement Tests
  // =============================================
  describe('generateIncomeStatement', () => {
    it('should generate income statement for period', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      expect(report).toBeDefined();
      expect(report.periodStart).toBe('2025-01-01');
      expect(report.periodEnd).toBe('2025-01-31');
    });

    it('should have revenue section', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      expect(report.revenue).toBeDefined();
      expect(report.revenue.title).toBe('Revenue');
      expect(report.revenue.accounts).toBeInstanceOf(Array);
    });

    it('should have COGS section', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      expect(report.costOfGoodsSold).toBeDefined();
      expect(report.costOfGoodsSold.title).toBe('Cost of Goods Sold');
    });

    it('should have operating expenses section', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      expect(report.operatingExpenses).toBeDefined();
      expect(report.operatingExpenses.title).toBe('Operating Expenses');
    });

    it('should calculate gross profit correctly', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      // From seeded data: Sales = 10,000 (COGS = 0 in seeded data)
      expect(report.revenue.subtotal).toBe(10000);
      expect(report.grossProfit).toBe(report.revenue.subtotal - report.costOfGoodsSold.subtotal);
    });

    it('should calculate net income correctly', async () => {
      const report = await generateIncomeStatement('2025-01-01', '2025-01-31');

      const expectedNetIncome =
        report.revenue.subtotal -
        report.costOfGoodsSold.subtotal -
        report.operatingExpenses.subtotal -
        report.otherIncomeExpenses.subtotal -
        report.incomeTax;

      expect(report.netIncome).toBe(expectedNetIncome);
    });

    it('should return zero revenue for period with no transactions', async () => {
      const report = await generateIncomeStatement('2024-01-01', '2024-01-31');

      expect(report.revenue.subtotal).toBe(0);
      expect(report.netIncome).toBe(0);
    });
  });

  // =============================================
  // Cash Flow Statement Tests
  // =============================================
  describe('generateCashFlowStatement', () => {
    it('should generate cash flow statement for period', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      expect(report).toBeDefined();
      expect(report.periodStart).toBe('2025-01-01');
      expect(report.periodEnd).toBe('2025-01-31');
    });

    it('should have operating activities section', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      expect(report.operatingActivities).toBeDefined();
      expect(report.operatingActivities.netIncome).toBeDefined();
      expect(report.operatingActivities.adjustments).toBeDefined();
      expect(report.operatingActivities.workingCapitalChanges).toBeDefined();
      expect(report.operatingActivities.netCashFromOperating).toBeDefined();
    });

    it('should have investing activities section', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      expect(report.investingActivities).toBeDefined();
      expect(report.investingActivities.section).toBeDefined();
      expect(report.investingActivities.netCashFromInvesting).toBeDefined();
    });

    it('should have financing activities section', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      expect(report.financingActivities).toBeDefined();
      expect(report.financingActivities.section).toBeDefined();
      expect(report.financingActivities.netCashFromFinancing).toBeDefined();
    });

    it('should calculate net change in cash', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      const expectedNetChange =
        report.operatingActivities.netCashFromOperating +
        report.investingActivities.netCashFromInvesting +
        report.financingActivities.netCashFromFinancing;

      expect(report.netChangeInCash).toBe(expectedNetChange);
    });

    it('should track beginning and ending cash balances', async () => {
      const report = await generateCashFlowStatement('2025-01-01', '2025-01-31');

      expect(typeof report.beginningCashBalance).toBe('number');
      expect(typeof report.endingCashBalance).toBe('number');
    });
  });

  // =============================================
  // Aging Report Tests
  // =============================================
  describe('generateAgingReport', () => {
    it('should generate AP aging report', async () => {
      const report = await generateAgingReport('AP', '2025-01-31');

      expect(report).toBeDefined();
      expect(report.reportType).toBe('AP');
      expect(report.asOfDate).toBe('2025-01-31');
      expect(report.entries).toBeInstanceOf(Array);
      expect(report.buckets).toBeInstanceOf(Array);
      expect(report.totals).toBeDefined();
    });

    it('should generate AR aging report', async () => {
      const report = await generateAgingReport('AR', '2025-01-31');

      expect(report).toBeDefined();
      expect(report.reportType).toBe('AR');
      expect(report.asOfDate).toBe('2025-01-31');
    });

    it('should have correct aging buckets', async () => {
      const report = await generateAgingReport('AP', '2025-01-31');

      expect(report.buckets.length).toBe(5);
      expect(report.buckets[0].range).toBe('Current');
      expect(report.buckets[1].range).toBe('1-30 Days');
      expect(report.buckets[2].range).toBe('31-60 Days');
      expect(report.buckets[3].range).toBe('61-90 Days');
      expect(report.buckets[4].range).toBe('90+ Days');
    });

    it('should calculate totals correctly', async () => {
      const report = await generateAgingReport('AP', '2025-01-31');

      const expectedTotal =
        report.totals.current +
        report.totals.days1to30 +
        report.totals.days31to60 +
        report.totals.days61to90 +
        report.totals.over90;

      expect(report.totals.total).toBe(expectedTotal);
    });

    it('should return empty entries when no unpaid invoices exist', async () => {
      const report = await generateAgingReport('AR', '2025-01-31');

      // No AR invoices in seeded data
      expect(report.entries.length).toBe(0);
      expect(report.totals.total).toBe(0);
    });

    describe('with AP invoices', () => {
      beforeEach(() => {
        // Add an unpaid AP invoice
        testSqlite.exec(`
          INSERT INTO ap_invoices (
            id, invoice_number, vendor_id, invoice_date, due_date, received_date,
            subtotal, vat_amount, total_amount, paid_amount, status, currency,
            exchange_rate, created_by, created_at, updated_at
          ) VALUES (
            1, 'INV-001', ${ACCT_TEST_IDS.VENDOR_1}, '2025-01-10', '2025-02-10', '2025-01-10',
            5000, 350, 5350, 0, 'posted', 'THB',
            1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
        `);
      });

      it('should include unpaid AP invoices in aging', async () => {
        const report = await generateAgingReport('AP', '2025-01-31');

        // Invoice due 2025-02-10, report as of 2025-01-31 = current (not yet due)
        expect(report.entries.length).toBe(1);
        expect(report.totals.current).toBe(5350);
      });

      it('should age invoices correctly based on due date', async () => {
        // Test with date after due date
        const report = await generateAgingReport('AP', '2025-02-15');

        // Invoice due 2025-02-10, as of 2025-02-15 = 5 days overdue (1-30 bucket)
        expect(report.totals.days1to30).toBe(5350);
      });
    });

    describe('with AR invoices', () => {
      beforeEach(() => {
        // Add unpaid AR invoices with different aging
        testSqlite.exec(`
          INSERT INTO ar_invoices (
            id, invoice_number, tax_invoice_number, customer_id, invoice_date, due_date,
            subtotal, vat_amount, total_amount, paid_amount, status, currency,
            exchange_rate, created_by, created_at, updated_at
          ) VALUES
            (1, 'INV-A001', 'TAX-001', ${ACCT_TEST_IDS.CUSTOMER_1}, '2025-01-10', '2025-02-10',
             10000, 700, 10700, 0, 'posted', 'THB', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            (2, 'INV-A002', 'TAX-002', ${ACCT_TEST_IDS.CUSTOMER_1}, '2024-11-10', '2024-12-10',
             5000, 350, 5350, 0, 'posted', 'THB', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `);
      });

      it('should include unpaid AR invoices in aging', async () => {
        const report = await generateAgingReport('AR', '2025-01-31');

        expect(report.entries.length).toBeGreaterThan(0);
        expect(report.totals.total).toBe(16050); // 10700 + 5350
      });

      it('should categorize invoices by age correctly', async () => {
        const report = await generateAgingReport('AR', '2025-01-31');

        // INV-A001 due 2025-02-10 (current)
        // INV-A002 due 2024-12-10 (52 days overdue as of 2025-01-31 = 31-60 bucket)
        expect(report.totals.current).toBe(10700);
        expect(report.totals.days31to60).toBe(5350);
      });
    });
  });
});
