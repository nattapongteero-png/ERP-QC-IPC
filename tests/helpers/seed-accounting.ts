/**
 * Accounting Test Helpers
 * Feature: 010-accounting-module-integration
 *
 * Provides test data seeding functions for accounting module tests.
 * Uses SQLite for testing.
 */

import Database from 'better-sqlite3';
import { TEST_USER_IDS } from './test-constants';

// ============================================
// Test Constants for Accounting
// ============================================

export const ACCT_TEST_IDS = {
  // GL Account Types
  ASSET_TYPE: 1,
  LIABILITY_TYPE: 2,
  EQUITY_TYPE: 3,
  REVENUE_TYPE: 4,
  EXPENSE_TYPE: 5,

  // GL Accounts
  CASH: 101,
  BANK_ACCOUNT: 102,
  AR_DOMESTIC: 103,
  INVENTORY_RAW: 104,
  INVENTORY_FG: 105,
  FIXED_ASSETS: 106,
  ACCUM_DEPR: 107,
  AP_DOMESTIC: 201,
  OUTPUT_VAT: 202,
  INPUT_VAT: 203,
  INPUT_VAT_RECV: 204, // 1141 for approveAPInvoice
  WHT_PAYABLE: 205, // 2143 for payments
  GRIR_CLEARING: 206, // 2113 GR/IR clearing — bridges goods receipt and vendor invoice
  SHARE_CAPITAL: 301,
  RETAINED_EARNINGS: 302,
  SALES_REVENUE: 401,
  COGS: 501,
  SALARY_EXPENSE: 601,

  // Manufacturing Cost Accounts (US4)
  INVENTORY_WIP: 108,          // 1132 Work-In-Progress
  MANUFACTURING_LABOR: 602,    // 5210 Manufacturing Labor
  MANUFACTURING_OVERHEAD: 603, // 5220 Manufacturing Overhead
  COST_OF_GOODS_MFG: 502,      // 5120 Cost of Goods Manufactured

  // Fiscal Year/Period
  FISCAL_YEAR_2025: 1,
  FISCAL_YEAR_2026: 2,
  FISCAL_PERIOD_JAN: 1,
  FISCAL_PERIOD_FEB: 2,
  FISCAL_PERIOD_DEC: 12,
  // 2026 periods start at 13
  FISCAL_PERIOD_2026_JAN: 13,

  // Journal Entries
  JE_SALES: 1,
  JE_PURCHASE: 2,
  JE_PAYMENT: 3,

  // Invoices
  AP_INVOICE_1: 1,
  AR_INVOICE_1: 1,

  // Vendors/Customers
  VENDOR_1: 1,
  CUSTOMER_1: 1,

  // Aliases for convenience
  VENDOR: 1,
  EXPENSE: 501, // Same as COGS
  BANK: 102, // Same as BANK_ACCOUNT
};

export const ACCT_TEST_DATES = {
  FISCAL_YEAR_START: '2025-01-01',
  FISCAL_YEAR_END: '2025-12-31',
  JAN_START: '2025-01-01',
  JAN_END: '2025-01-31',
  FEB_START: '2025-02-01',
  FEB_END: '2025-02-28',
  TODAY: '2025-01-15',
  INVOICE_DATE: '2025-01-10',
  DUE_DATE: '2025-02-10',
};

// ============================================
// Seed Functions
// ============================================

/**
 * Seed GL Account Types
 */
export function seedGLAccountTypes(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO gl_account_types (id, code, name_th, name_en, category, normal_balance, display_order, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.ASSET_TYPE}, '1', 'สินทรัพย์', 'Assets', 'asset', 'debit', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.LIABILITY_TYPE}, '2', 'หนี้สิน', 'Liabilities', 'liability', 'credit', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.EQUITY_TYPE}, '3', 'ส่วนของผู้ถือหุ้น', 'Equity', 'equity', 'credit', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.REVENUE_TYPE}, '4', 'รายได้', 'Revenue', 'revenue', 'credit', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.EXPENSE_TYPE}, '5', 'ค่าใช้จ่าย', 'Expenses', 'expense', 'debit', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed GL Accounts (Chart of Accounts)
 */
export function seedGLAccounts(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO gl_accounts (id, code, name_th, name_en, account_type_id, parent_id, level, is_active, is_postable, is_bank_account, created_by, created_at, updated_at)
    VALUES
      -- Assets
      (${ACCT_TEST_IDS.CASH}, '1111', 'เงินสด', 'Cash', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.BANK_ACCOUNT}, '1112', 'เงินฝากธนาคาร', 'Bank Account', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.AR_DOMESTIC}, '1121', 'ลูกหนี้การค้า', 'Accounts Receivable', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.INVENTORY_RAW}, '1131', 'วัตถุดิบ', 'Raw Materials', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.INVENTORY_FG}, '1133', 'สินค้าสำเร็จรูป', 'Finished Goods', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.INVENTORY_WIP}, '1132', 'งานระหว่างทำ', 'Work-In-Progress', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.FIXED_ASSETS}, '1213', 'เครื่องจักรและอุปกรณ์', 'Machinery', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.ACCUM_DEPR}, '1223', 'ค่าเสื่อมราคาสะสม', 'Accum. Depreciation', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.INPUT_VAT}, '1142', 'ภาษีซื้อ', 'Input VAT', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.INPUT_VAT_RECV}, '1141', 'ภาษีซื้อรอขอคืน', 'Input VAT Receivable', ${ACCT_TEST_IDS.ASSET_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Liabilities
      (${ACCT_TEST_IDS.AP_DOMESTIC}, '2111', 'เจ้าหนี้การค้า', 'Accounts Payable', ${ACCT_TEST_IDS.LIABILITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.OUTPUT_VAT}, '2131', 'ภาษีขาย', 'Output VAT', ${ACCT_TEST_IDS.LIABILITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.WHT_PAYABLE}, '2143', 'ภาษีหัก ณ ที่จ่าย', 'WHT Payable', ${ACCT_TEST_IDS.LIABILITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.GRIR_CLEARING}, '2113', 'พักรับสินค้า', 'GR/IR Clearing', ${ACCT_TEST_IDS.LIABILITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Equity
      (${ACCT_TEST_IDS.SHARE_CAPITAL}, '3120', 'ทุนที่ออกและชำระแล้ว', 'Paid-up Capital', ${ACCT_TEST_IDS.EQUITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.RETAINED_EARNINGS}, '3220', 'กำไรสะสม', 'Retained Earnings', ${ACCT_TEST_IDS.EQUITY_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Revenue
      (${ACCT_TEST_IDS.SALES_REVENUE}, '4110', 'รายได้จากการขาย', 'Sales Revenue', ${ACCT_TEST_IDS.REVENUE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

      -- Expenses
      (${ACCT_TEST_IDS.COGS}, '5110', 'ต้นทุนขาย', 'Cost of Goods Sold', ${ACCT_TEST_IDS.EXPENSE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.COST_OF_GOODS_MFG}, '5120', 'ต้นทุนผลิต', 'Cost of Goods Manufactured', ${ACCT_TEST_IDS.EXPENSE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.SALARY_EXPENSE}, '6210', 'เงินเดือน', 'Salaries', ${ACCT_TEST_IDS.EXPENSE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.MANUFACTURING_LABOR}, '5210', 'ค่าแรงงานผลิต', 'Manufacturing Labor', ${ACCT_TEST_IDS.EXPENSE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.MANUFACTURING_OVERHEAD}, '5220', 'ค่าใช้จ่ายการผลิต', 'Manufacturing Overhead', ${ACCT_TEST_IDS.EXPENSE_TYPE}, NULL, 1, 1, 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed Fiscal Year and Periods
 */
export function seedFiscalYearAndPeriods(sqlite: Database.Database): void {
  // Fiscal Years (2025 and 2026 for tests that use current date)
  sqlite.exec(`
    INSERT OR IGNORE INTO fiscal_years (id, year_code, start_date, end_date, is_current, status, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.FISCAL_YEAR_2025}, 'FY2025', '${ACCT_TEST_DATES.FISCAL_YEAR_START}', '${ACCT_TEST_DATES.FISCAL_YEAR_END}', 0, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${ACCT_TEST_IDS.FISCAL_YEAR_2026}, 'FY2026', '2026-01-01', '2026-12-31', 1, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  // Fiscal Periods for 2025 (12 months)
  const months2025 = [
    { num: 1, name: 'January', start: '2025-01-01', end: '2025-01-31' },
    { num: 2, name: 'February', start: '2025-02-01', end: '2025-02-28' },
    { num: 3, name: 'March', start: '2025-03-01', end: '2025-03-31' },
    { num: 4, name: 'April', start: '2025-04-01', end: '2025-04-30' },
    { num: 5, name: 'May', start: '2025-05-01', end: '2025-05-31' },
    { num: 6, name: 'June', start: '2025-06-01', end: '2025-06-30' },
    { num: 7, name: 'July', start: '2025-07-01', end: '2025-07-31' },
    { num: 8, name: 'August', start: '2025-08-01', end: '2025-08-31' },
    { num: 9, name: 'September', start: '2025-09-01', end: '2025-09-30' },
    { num: 10, name: 'October', start: '2025-10-01', end: '2025-10-31' },
    { num: 11, name: 'November', start: '2025-11-01', end: '2025-11-30' },
    { num: 12, name: 'December', start: '2025-12-01', end: '2025-12-31' },
  ];

  for (const month of months2025) {
    sqlite.exec(`
      INSERT OR IGNORE INTO fiscal_periods (id, fiscal_year_id, period_number, period_name, start_date, end_date, status, created_at, updated_at)
      VALUES
        (${month.num}, ${ACCT_TEST_IDS.FISCAL_YEAR_2025}, ${month.num}, '${month.name}', '${month.start}', '${month.end}', 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  }

  // Fiscal Periods for 2026 (12 months) - for tests that use current date
  const months2026 = [
    { num: 13, name: 'January', start: '2026-01-01', end: '2026-01-31' },
    { num: 14, name: 'February', start: '2026-02-01', end: '2026-02-28' },
    { num: 15, name: 'March', start: '2026-03-01', end: '2026-03-31' },
    { num: 16, name: 'April', start: '2026-04-01', end: '2026-04-30' },
    { num: 17, name: 'May', start: '2026-05-01', end: '2026-05-31' },
    { num: 18, name: 'June', start: '2026-06-01', end: '2026-06-30' },
    { num: 19, name: 'July', start: '2026-07-01', end: '2026-07-31' },
    { num: 20, name: 'August', start: '2026-08-01', end: '2026-08-31' },
    { num: 21, name: 'September', start: '2026-09-01', end: '2026-09-30' },
    { num: 22, name: 'October', start: '2026-10-01', end: '2026-10-31' },
    { num: 23, name: 'November', start: '2026-11-01', end: '2026-11-30' },
    { num: 24, name: 'December', start: '2026-12-01', end: '2026-12-31' },
  ];

  for (const month of months2026) {
    sqlite.exec(`
      INSERT OR IGNORE INTO fiscal_periods (id, fiscal_year_id, period_number, period_name, start_date, end_date, status, created_at, updated_at)
      VALUES
        (${month.num}, ${ACCT_TEST_IDS.FISCAL_YEAR_2026}, ${month.num - 12}, '${month.name}', '${month.start}', '${month.end}', 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
  }
}

/**
 * Seed sample journal entries
 */
export function seedJournalEntries(sqlite: Database.Database): void {
  // Sales Entry: Dr. AR 10,700, Cr. Sales 10,000, Cr. Output VAT 700
  sqlite.exec(`
    INSERT OR IGNORE INTO journal_entries (id, entry_number, entry_date, fiscal_period_id, description, source_type, status, total_debit, total_credit, created_by, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.JE_SALES}, 'JE-202501-000001', '${ACCT_TEST_DATES.INVOICE_DATE}', ${ACCT_TEST_IDS.FISCAL_PERIOD_JAN}, 'Sales transaction', 'SO_SHIPMENT', 'posted', 10700, 10700, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  sqlite.exec(`
    INSERT OR IGNORE INTO journal_lines (id, journal_entry_id, line_number, gl_account_id, debit, credit, description, created_at)
    VALUES
      (1, ${ACCT_TEST_IDS.JE_SALES}, 1, ${ACCT_TEST_IDS.AR_DOMESTIC}, 10700, 0, 'AR from sales', CURRENT_TIMESTAMP),
      (2, ${ACCT_TEST_IDS.JE_SALES}, 2, ${ACCT_TEST_IDS.SALES_REVENUE}, 0, 10000, 'Sales revenue', CURRENT_TIMESTAMP),
      (3, ${ACCT_TEST_IDS.JE_SALES}, 3, ${ACCT_TEST_IDS.OUTPUT_VAT}, 0, 700, 'Output VAT 7%', CURRENT_TIMESTAMP)
  `);

  // Purchase Entry: Dr. Inventory 5,000, Dr. Input VAT 350, Cr. AP 5,350
  sqlite.exec(`
    INSERT OR IGNORE INTO journal_entries (id, entry_number, entry_date, fiscal_period_id, description, source_type, status, total_debit, total_credit, created_by, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.JE_PURCHASE}, 'JE-202501-000002', '${ACCT_TEST_DATES.INVOICE_DATE}', ${ACCT_TEST_IDS.FISCAL_PERIOD_JAN}, 'Purchase transaction', 'PO_RECEIPT', 'posted', 5350, 5350, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  sqlite.exec(`
    INSERT OR IGNORE INTO journal_lines (id, journal_entry_id, line_number, gl_account_id, debit, credit, description, created_at)
    VALUES
      (4, ${ACCT_TEST_IDS.JE_PURCHASE}, 1, ${ACCT_TEST_IDS.INVENTORY_RAW}, 5000, 0, 'Raw materials purchase', CURRENT_TIMESTAMP),
      (5, ${ACCT_TEST_IDS.JE_PURCHASE}, 2, ${ACCT_TEST_IDS.INPUT_VAT}, 350, 0, 'Input VAT 7%', CURRENT_TIMESTAMP),
      (6, ${ACCT_TEST_IDS.JE_PURCHASE}, 3, ${ACCT_TEST_IDS.AP_DOMESTIC}, 0, 5350, 'AP from purchase', CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed sample vendor for AP tests
 */
export function seedVendors(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO vendors (id, code, name, is_active, is_approved, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.VENDOR_1}, 'VND-001', 'Test Vendor Co., Ltd.', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed sample customer for AR tests
 */
export function seedCustomers(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO customers (id, code, name, is_active, created_at, updated_at)
    VALUES
      (${ACCT_TEST_IDS.CUSTOMER_1}, 'CUS-001', 'Test Customer Co., Ltd.', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

// ============================================
// Composite Seed Functions
// ============================================

/**
 * Seed basic accounting data (account types, accounts, fiscal year)
 */
export function seedAccountingBasics(sqlite: Database.Database): void {
  seedGLAccountTypes(sqlite);
  seedGLAccounts(sqlite);
  seedFiscalYearAndPeriods(sqlite);
}

/**
 * Seed complete accounting test data
 */
export function seedAccountingTestData(sqlite: Database.Database): void {
  seedAccountingBasics(sqlite);
  seedJournalEntries(sqlite);
  seedVendors(sqlite);
  seedCustomers(sqlite);
}

/**
 * Seed data for journal entry tests
 */
export function seedJournalEntryTestData(sqlite: Database.Database): void {
  seedGLAccountTypes(sqlite);
  seedGLAccounts(sqlite);
  seedFiscalYearAndPeriods(sqlite);
}

/**
 * Seed data for AP invoice tests
 */
export function seedAPTestData(sqlite: Database.Database): void {
  seedAccountingBasics(sqlite);
  seedVendors(sqlite);
}

/**
 * Seed data for AR invoice tests
 */
export function seedARTestData(sqlite: Database.Database): void {
  seedAccountingBasics(sqlite);
  seedCustomers(sqlite);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a balanced test journal entry
 */
export function createTestJournalEntry(
  sqlite: Database.Database,
  options: {
    entryNumber: string;
    entryDate: string;
    fiscalPeriodId: number;
    description: string;
    lines: Array<{ accountId: number; debit: number; credit: number; description: string }>;
    createdBy?: number;
    status?: string;
  }
): number {
  const totalDebit = options.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = options.lines.reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry is not balanced: Debit ${totalDebit} != Credit ${totalCredit}`);
  }

  const result = sqlite
    .prepare(
      `
    INSERT INTO journal_entries (entry_number, entry_date, fiscal_period_id, description, status, total_debit, total_credit, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `
    )
    .run(
      options.entryNumber,
      options.entryDate,
      options.fiscalPeriodId,
      options.description,
      options.status || 'draft',
      totalDebit,
      totalCredit,
      options.createdBy || 1
    );

  const journalEntryId = result.lastInsertRowid as number;

  // Insert lines
  const insertLine = sqlite.prepare(`
    INSERT INTO journal_lines (journal_entry_id, line_number, gl_account_id, debit, credit, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  options.lines.forEach((line, index) => {
    insertLine.run(journalEntryId, index + 1, line.accountId, line.debit, line.credit, line.description);
  });

  return journalEntryId;
}

/**
 * Get account balance from journal entries
 */
export function getAccountBalance(sqlite: Database.Database, accountId: number): number {
  const result = sqlite
    .prepare(
      `
    SELECT
      COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0) as balance
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE jl.gl_account_id = ? AND je.status = 'posted'
  `
    )
    .get(accountId) as { balance: number };

  return result?.balance || 0;
}

/**
 * Verify trial balance is balanced
 */
export function verifyTrialBalance(sqlite: Database.Database): { totalDebit: number; totalCredit: number; isBalanced: boolean } {
  const result = sqlite
    .prepare(
      `
    SELECT
      COALESCE(SUM(jl.debit), 0) as total_debit,
      COALESCE(SUM(jl.credit), 0) as total_credit
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_entry_id = je.id
    WHERE je.status = 'posted'
  `
    )
    .get() as { total_debit: number; total_credit: number };

  return {
    totalDebit: result?.total_debit || 0,
    totalCredit: result?.total_credit || 0,
    isBalanced: Math.abs((result?.total_debit || 0) - (result?.total_credit || 0)) < 0.01,
  };
}

// ============================================
// Manufacturing Cost Accounting Test Data (US4)
// ============================================

export const MANUFACTURING_TEST_IDS = {
  // Items
  RAW_MATERIAL_1: 1,
  RAW_MATERIAL_2: 2,
  WIP_ITEM: 3,
  FINISHED_GOODS: 4,

  // Work Orders
  WORK_ORDER_1: 1,
  WORK_ORDER_2: 2,

  // Lots
  LOT_1: 1,
  LOT_2: 2,
};

/**
 * Seed items for cost allocation tests
 */
export function seedItems(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO items (id, code, name_th, name_en, type, category, primary_unit, is_lot_controlled, is_fefo, is_active, on_hand, on_hand_cost, created_at, updated_at)
    VALUES
      (${MANUFACTURING_TEST_IDS.RAW_MATERIAL_1}, 'RM-001', 'วัตถุดิบ 1', 'Raw Material 1', 'raw_material', 'herbs', 'kg', 1, 1, 1, 100, 5000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${MANUFACTURING_TEST_IDS.RAW_MATERIAL_2}, 'RM-002', 'วัตถุดิบ 2', 'Raw Material 2', 'raw_material', 'herbs', 'kg', 1, 1, 1, 50, 2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${MANUFACTURING_TEST_IDS.WIP_ITEM}, 'WIP-001', 'งานระหว่างทำ 1', 'Work In Progress 1', 'wip', 'production', 'unit', 1, 1, 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${MANUFACTURING_TEST_IDS.FINISHED_GOODS}, 'FG-001', 'สินค้าสำเร็จรูป 1', 'Finished Goods 1', 'finished_goods', 'products', 'box', 1, 1, 1, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed work orders for cost allocation tests
 */
export function seedWorkOrders(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO work_orders (id, wo_number, bom_id, product_id, batch_number, planned_quantity, actual_quantity, unit, status, priority, planned_start_date, planned_end_date, created_by, created_at, updated_at)
    VALUES
      (${MANUFACTURING_TEST_IDS.WORK_ORDER_1}, 'WO-202501-0001', 1, ${MANUFACTURING_TEST_IDS.FINISHED_GOODS}, 'BATCH-001', 100, 0, 'box', 'in_progress', 5, '2025-01-15', '2025-01-20', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${MANUFACTURING_TEST_IDS.WORK_ORDER_2}, 'WO-202501-0002', 1, ${MANUFACTURING_TEST_IDS.FINISHED_GOODS}, 'BATCH-002', 50, 50, 'box', 'completed', 5, '2025-01-10', '2025-01-12', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed inventory lots for cost allocation tests
 */
export function seedInventoryLots(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO inventory_lots (id, item_id, lot_number, warehouse_id, quantity, reserved_quantity, unit, status, expiry_date, received_date, created_at, updated_at)
    VALUES
      (${MANUFACTURING_TEST_IDS.LOT_1}, ${MANUFACTURING_TEST_IDS.RAW_MATERIAL_1}, 'LOT-RM001-001', 1, 100, 0, 'kg', 'released', '2026-01-15', '2025-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      (${MANUFACTURING_TEST_IDS.LOT_2}, ${MANUFACTURING_TEST_IDS.RAW_MATERIAL_2}, 'LOT-RM002-001', 1, 50, 0, 'kg', 'released', '2026-02-15', '2025-01-05', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed BOMs for work order references
 */
export function seedBOMs(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO bom (id, code, name, product_id, version, status, batch_size, batch_unit, effective_date, created_at, updated_at)
    VALUES
      (1, 'BOM-001', 'Test BOM', ${MANUFACTURING_TEST_IDS.FINISHED_GOODS}, '1.0', 'approved', 100, 'box', '2025-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed warehouse for lot references
 */
export function seedWarehouses(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT OR IGNORE INTO warehouses (id, code, name, type, is_active, created_at, updated_at)
    VALUES
      (1, 'WH-001', 'Main Warehouse', 'main', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
}

/**
 * Seed complete manufacturing cost test data
 */
export function seedManufacturingCostTestData(sqlite: Database.Database): void {
  seedAccountingBasics(sqlite);
  seedWarehouses(sqlite);
  seedItems(sqlite);
  seedBOMs(sqlite);
  seedWorkOrders(sqlite);
  seedInventoryLots(sqlite);
}
